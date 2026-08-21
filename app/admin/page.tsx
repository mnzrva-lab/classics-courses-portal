import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CourseRelation = {
  slug: string
  title: string
  canonical_number: number | null
}

type OfferingRelation = {
  id: string
  slug: string
  label: string
  status: string
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  if (!userId) {
    return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') {
    return <main className="container page"><div className="card"><h1>Admin access has not been assigned</h1><p>Your study account is working. Admin access is assigned separately.</p><Link className="button" href="/my-learning">Back to My Learning</Link></div></main>
  }

  const [{ data: offeringRows }, { data: sessionRows }] = await Promise.all([
    supabase
      .from('course_offerings')
      .select('id, slug, label, status, sort_order, courses(slug, title, canonical_number)')
      .order('sort_order', { ascending: true }),
    supabase
      .from('sessions')
      .select(`
        id, code, title, session_type, status, session_date, recording_url,
        courses(slug, title, canonical_number),
        course_offerings(id, slug, label, status),
        study_notes(status),
        transcripts(status),
        materials(status)
      `)
      .order('starts_at', { ascending: true, nullsFirst: false }),
  ])

  const sessions = sessionRows ?? []
  type SessionRow = (typeof sessions)[number]
  type Group = {
    title: string
    courseSlug: string | null
    offeringId: string | null
    offeringSlug: string | null
    offeringStatus: string | null
    sessions: SessionRow[]
  }
  const groups = new Map<string, Group>()

  for (const offeringRow of offeringRows ?? []) {
    const course = offeringRow.courses as unknown as CourseRelation | null
    const title = `${course?.canonical_number ? `Course ${course.canonical_number} · ` : ''}${course?.title ?? 'Other program'} · ${offeringRow.label}`
    groups.set(`offering:${offeringRow.id}`, {
      title,
      courseSlug: course?.slug ?? null,
      offeringId: offeringRow.id,
      offeringSlug: offeringRow.slug,
      offeringStatus: offeringRow.status,
      sessions: [],
    })
  }

  for (const session of sessions) {
    const course = session.courses as unknown as CourseRelation | null
    const offering = session.course_offerings as unknown as OfferingRelation | null
    const key = offering?.id ? `offering:${offering.id}` : `${course?.slug ?? 'other'}:none`
    const title = `${course?.canonical_number ? `Course ${course.canonical_number} · ` : ''}${course?.title ?? 'Other program'}${offering ? ` · ${offering.label}` : ''}`
    if (!groups.has(key)) {
      groups.set(key, {
        title,
        courseSlug: course?.slug ?? null,
        offeringId: offering?.id ?? null,
        offeringSlug: offering?.slug ?? null,
        offeringStatus: offering?.status ?? null,
        sessions: [],
      })
    }
    groups.get(key)!.sessions.push(session)
  }

  return (
    <main className="container page">
      <div className="eyebrow">Admin</div>
      <h1>Teaching content</h1>
      <p className="lead">Manage courses, Course Offerings, sessions, teachers, class materials, Study Notes, Reference Transcripts, and the meditation library.</p>

      <section className="grid section">
        <div className="card">
          <div className="eyebrow">Catalog</div>
          <h3>Courses &amp; Programs</h3>
          <p className="meta">Manage the canonical course catalog and create additional text studies or other programs without touching code.</p>
          <div className="actions">
            <Link className="button red" href="/admin/courses">Manage courses &amp; programs</Link>
            <Link className="button" href="/admin/offerings/new">Create Course Offering</Link>
            <Link className="button sage" href="/admin/bulk-sessions">Bulk create sessions</Link>
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">People</div>
          <h3>Teachers</h3>
          <p className="meta">Add teachers once, then assign them to any class or meditation from the session editor.</p>
          <div className="actions"><Link className="button" href="/admin/teachers">Manage teachers</Link></div>
        </div>
        <div className="card">
          <div className="eyebrow">Practice library</div>
          <h3>Meditations</h3>
          <p className="meta">Create a canonical meditation once, then connect versions from different source classes.</p>
          <div className="actions"><Link className="button sage" href="/admin/meditations">Manage meditations</Link></div>
        </div>
      </section>

      {[...groups.entries()].map(([key, group]) => (
        <section className="section card" key={key}>
          <div className="eyebrow">Course Offering{group.offeringStatus ? ` · ${group.offeringStatus}` : ''}</div>
          <h2>{group.title}</h2>
          <div className="actions" style={{ marginBottom: 12 }}>
            {group.offeringId ? <Link className="button red" href={`/admin/offerings/${group.offeringId}`}>Manage Course Offering</Link> : null}
            {group.offeringId ? <Link className="button sage" href={`/admin/offerings/${group.offeringId}/review`}>Review content</Link> : null}
            {group.courseSlug && group.offeringSlug && group.offeringStatus === 'published' ? <Link className="button" href={`/courses/${group.courseSlug}/${group.offeringSlug}`}>Open student view</Link> : null}
          </div>

          {group.sessions.length ? group.sessions.map((session) => {
            const notes = (session.study_notes ?? []) as Array<{ status: string }>
            const transcripts = (session.transcripts ?? []) as Array<{ status: string }>
            const materials = (session.materials ?? []) as Array<{ status: string }>
            const notesStatus = notes[0]?.status ?? 'missing'
            const transcriptStatus = transcripts[0]?.status ?? 'missing'
            const publishedMaterials = materials.filter((item) => item.status === 'published').length
            return (
              <div key={session.id} style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <strong>{session.code ? `${session.code} · ` : ''}{session.title}</strong>
                    <div className="meta">{session.session_date ?? 'No date'} · {session.session_type} · session {session.status}</div>
                    <div className="meta">Study Notes: {notesStatus} · Materials: {publishedMaterials} published · Transcript: {transcriptStatus} · Recording: {session.recording_url ? 'added' : 'missing'}</div>
                  </div>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <Link className="button" href={`/admin/sessions/${session.id}`}>Edit session</Link>
                    {transcriptStatus !== 'missing' ? <Link className="button" href={`/admin/sessions/${session.id}/revisions`}>Transcript history</Link> : null}
                  </div>
                </div>
              </div>
            )
          }) : <p className="meta">No sessions yet. Open this Course Offering to add the first class or meditation.</p>}
        </section>
      ))}
    </main>
  )
}
