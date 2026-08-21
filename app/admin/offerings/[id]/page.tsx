import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSession, updateOffering } from './actions'
import BulkTranscriptImport from './bulk-transcript-import'

export const dynamic = 'force-dynamic'

type CourseRelation = {
  id: string
  slug: string
  title: string
  canonical_number: number | null
}

type Teacher = {
  id: string
  full_name: string
  active: boolean
}

type TranscriptRelation = {
  status: string
}

export default async function AdminOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const { id } = await params
  const { saved } = await searchParams
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) {
    return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') {
    return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>
  }

  const [{ data: offering }, { data: teacherRows }, { data: sessionRows }] = await Promise.all([
    supabase
      .from('course_offerings')
      .select('id, slug, label, location, year, language_codes, artwork_url, description, telegram_url, starts_on, ends_on, status, courses(id, slug, title, canonical_number)')
      .eq('id', id)
      .single(),
    supabase.from('teachers').select('id, full_name, active').eq('active', true).order('full_name'),
    supabase.from('sessions').select('id, code, title, session_type, status, session_date, source_timezone, sort_order, transcripts(status)').eq('offering_id', id).order('sort_order'),
  ])

  if (!offering) notFound()
  const course = offering.courses as unknown as CourseRelation
  const teachers = (teacherRows ?? []) as Teacher[]
  const sessions = sessionRows ?? []
  const defaultTimezone = sessions.find((session) => session.source_timezone)?.source_timezone ?? 'Asia/Taipei'
  const bulkSessions = sessions.map((session) => {
    const transcripts = (session.transcripts ?? []) as TranscriptRelation[]
    return {
      id: session.id,
      code: session.code,
      title: session.title,
      transcriptStatus: transcripts[0]?.status ?? null,
    }
  })

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Course Offering</div>
      <h1>{course.canonical_number ? `Course ${course.canonical_number} · ` : ''}{course.title}</h1>
      <p className="lead">Manage the offering itself and add teaching sessions without touching code.</p>

      {saved === 'offering' ? <div className="card completed" style={{ marginTop: 20 }}>Course Offering saved.</div> : null}

      <section className="section card">
        <div className="eyebrow">Course Offering</div>
        <h2 style={{ fontSize: 32 }}>{offering.label}</h2>
        <form className="form-stack" action={updateOffering.bind(null, offering.id)}>
          <div className="grid two">
            <label>Student-facing label<input className="input" name="label" defaultValue={offering.label} placeholder="Taiwan · 2026" required /></label>
            <label>Location<input className="input" name="location" defaultValue={offering.location ?? ''} placeholder="Taiwan" /></label>
            <label>Year<input className="input" name="year" type="number" min="1900" max="2200" defaultValue={offering.year ?? ''} /></label>
            <label>Languages<input className="input" name="language_codes" defaultValue={(offering.language_codes ?? []).join(', ')} placeholder="en, zh" /></label>
            <label>Starts on<input className="input" name="starts_on" type="date" defaultValue={offering.starts_on ?? ''} /></label>
            <label>Ends on<input className="input" name="ends_on" type="date" defaultValue={offering.ends_on ?? ''} /></label>
          </div>
          <label>Description<textarea className="input" name="description" rows={4} defaultValue={offering.description ?? ''} /></label>
          <label>Artwork URL<input className="input" name="artwork_url" type="url" defaultValue={offering.artwork_url ?? ''} /></label>
          <label>Telegram URL<input className="input" name="telegram_url" type="url" defaultValue={offering.telegram_url ?? ''} /></label>
          <label>Status
            <select className="input" name="status" defaultValue={offering.status}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div className="actions">
            <button className="button red" type="submit">Save Course Offering</button>
            <Link className="button" href={`/courses/${course.slug}/${offering.slug}`}>Student view</Link>
          </div>
        </form>
      </section>

      <section className="section card">
        <div className="eyebrow">Sessions</div>
        <h2 style={{ fontSize: 32 }}>Existing teaching sessions</h2>
        {sessions.length ? sessions.map((session) => {
          const transcripts = (session.transcripts ?? []) as TranscriptRelation[]
          return (
            <div key={session.id} style={{ padding: '14px 0', borderTop: '1px solid var(--line)', display: 'flex', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div>
                <strong>{session.code ? `${session.code} · ` : ''}{session.title}</strong>
                <div className="meta">{session.session_date ?? 'No date'} · {session.session_type} · {session.status} · Transcript: {transcripts[0]?.status ?? 'missing'}</div>
              </div>
              <Link className="button" href={`/admin/sessions/${session.id}`}>Edit</Link>
            </div>
          )
        }) : <p className="meta">No sessions have been added yet.</p>}
      </section>

      <section className="section card">
        <div className="eyebrow">Bulk import</div>
        <h2 style={{ fontSize: 32 }}>Import Reference Transcripts</h2>
        <p className="meta">Select several DOCX, Markdown, or text transcripts for this Course Offering. The importer matches Class and Meditation numbers from each filename, preserves embedded DOCX images, and saves every new transcript as Draft for review.</p>
        <BulkTranscriptImport offeringId={offering.id} sessions={bulkSessions} />
      </section>

      <section className="section card">
        <div className="eyebrow">Add session</div>
        <h2 style={{ fontSize: 32 }}>Create a class, meditation, review, or Q&amp;A</h2>
        <p className="meta">New sessions can stay Draft until the details are ready. After creation, you can add Study Notes and the Reference Transcript.</p>

        <form className="form-stack" action={createSession.bind(null, offering.id, course.id)}>
          <div className="grid two">
            <label>Type
              <select className="input" name="session_type" defaultValue="class">
                <option value="class">Class</option>
                <option value="meditation">Meditation</option>
                <option value="review">Review</option>
                <option value="qna">Q&amp;A</option>
                <option value="vows">Vows</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>Code<input className="input" name="code" placeholder="C11, M5, Q&A" /></label>
          </div>
          <label>Title<input className="input" name="title" placeholder="Class 11" required /></label>

          <div className="grid two">
            <label>Date<input className="input" type="date" name="session_date" /></label>
            <label>Source timezone<input className="input" name="source_timezone" defaultValue={defaultTimezone} placeholder="Asia/Taipei" /></label>
            <label>Start time<input className="input" type="time" name="start_time" /></label>
            <label>End time<input className="input" type="time" name="end_time" /></label>
          </div>

          <label>Recording URL<input className="input" type="url" name="recording_url" placeholder="Optional" /></label>
          <label>Audio URL<input className="input" type="url" name="audio_url" placeholder="Optional" /></label>
          <label>Zoom URL<input className="input" type="url" name="zoom_url" placeholder="Optional" /></label>

          {teachers.length ? (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 700, marginBottom: 8 }}>Teacher</legend>
              <div className="actions">
                {teachers.map((teacher) => (
                  <label key={teacher.id} className="button" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" name="teacher_id" value={teacher.id} style={{ marginRight: 8 }} />
                    {teacher.full_name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" name="required_for_completion" defaultChecked />
            Required for course completion
          </label>

          <label>Status
            <select className="input" name="status" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <button className="button sage" type="submit">Create session</button>
        </form>
      </section>

      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
