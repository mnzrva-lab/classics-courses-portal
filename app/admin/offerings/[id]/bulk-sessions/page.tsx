import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import BulkSessionImport from '../bulk-session-import'

export const dynamic = 'force-dynamic'

type CourseRelation = { id: string; title: string; canonical_number: number | null; kind: string }

export default async function OfferingBulkSessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>

  const [{ data: offering }, { data: sessions }, { data: groups }] = await Promise.all([
    supabase
      .from('course_offerings')
      .select('id, label, status, courses(id, title, canonical_number, kind)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('sessions')
      .select('id, code, title, status, source_timezone')
      .eq('offering_id', id)
      .order('sort_order'),
    supabase
      .from('content_groups')
      .select('id, label, title, status')
      .eq('offering_id', id)
      .neq('status', 'archived')
      .order('sort_order'),
  ])

  if (!offering) notFound()
  const course = offering.courses as unknown as CourseRelation
  const defaultTimezone = (sessions ?? []).find((session) => session.source_timezone)?.source_timezone ?? 'America/Phoenix'

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Bulk session creation</div>
      <h1>{course.canonical_number ? `Course ${course.canonical_number} · ` : ''}{course.title}</h1>
      <p className="lead">{offering.label}</p>

      <section className="section card sage">
        <div className="eyebrow">Safety</div>
        <h2 style={{ fontSize: 30 }}>Imports always stay Draft</h2>
        <p className="meta">The importer does not publish sessions, does not overwrite an existing class with the same code or title, and stops individual rows that reference an unknown teacher or section.</p>
      </section>

      {(groups ?? []).length ? (
        <section className="section card">
          <div className="eyebrow">Available sections</div>
          <h2 style={{ fontSize: 30 }}>{course.kind === 'living_lam_rim' ? 'Term names you can use' : 'Section names you can use'}</h2>
          <div className="actions">
            {(groups ?? []).map((group) => <span className="pill" key={group.id}>{group.label}{group.title ? ` · ${group.title}` : ''}</span>)}
          </div>
        </section>
      ) : null}

      <section className="section card">
        <div className="eyebrow">Spreadsheet import</div>
        <h2 style={{ fontSize: 32 }}>Paste session rows</h2>
        <BulkSessionImport offeringId={offering.id} courseId={course.id} defaultTimezone={defaultTimezone} />
      </section>

      <section className="section card">
        <div className="eyebrow">Already in this Course Offering</div>
        <h2 style={{ fontSize: 30 }}>{(sessions ?? []).length} session{(sessions ?? []).length === 1 ? '' : 's'}</h2>
        {(sessions ?? []).length ? (sessions ?? []).map((session) => (
          <div key={session.id} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <strong>{session.code ? `${session.code} · ` : ''}{session.title}</strong>
            <span className="meta"> · {session.status}</span>
          </div>
        )) : <p className="meta">No sessions yet.</p>}
      </section>

      <section className="section actions">
        <Link className="button" href={`/admin/offerings/${offering.id}`}>← Back to Course Offering</Link>
        <Link className="button" href="/admin/bulk-sessions">Choose another Course Offering</Link>
      </section>
    </main>
  )
}
