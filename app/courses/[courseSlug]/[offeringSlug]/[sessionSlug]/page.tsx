import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { markSessionComplete, saveSessionNote } from './actions'

export default async function SessionPage({ params }: { params: Promise<{ courseSlug: string; offeringSlug: string; sessionSlug: string }> }) {
  const { courseSlug, offeringSlug, sessionSlug } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, slug, code, title, session_type, recording_url, audio_url, starts_at, source_timezone,
      courses!inner(id, slug, title, canonical_number),
      course_offerings!inner(id, slug, label),
      session_teachers(teachers(full_name))
    `)
    .eq('slug', sessionSlug)
    .eq('courses.slug', courseSlug)
    .eq('course_offerings.slug', offeringSlug)
    .eq('status', 'published')
    .single()

  if (!session) notFound()

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  const [{ data: progress }, { data: notes }, { data: studyNotes }, { data: transcript }] = await Promise.all([
    userId
      ? supabase.from('user_session_progress').select('completed_at, last_opened_at').eq('user_id', userId).eq('session_id', session.id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    userId
      ? supabase.from('student_notes').select('id, note, updated_at').eq('user_id', userId).eq('session_id', session.id).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] } as any),
    supabase.from('study_notes').select('title, summary, content_markdown, disclaimer').eq('session_id', session.id).eq('status', 'published').maybeSingle(),
    supabase.from('transcripts').select('id, title, disclaimer').eq('session_id', session.id).eq('status', 'published').maybeSingle(),
  ])

  const teachers = (session.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean)
  const returnPath = `/courses/${courseSlug}/${offeringSlug}/${sessionSlug}`

  return (
    <main className="container page">
      <div className="eyebrow">{session.courses.title} · {session.course_offerings.label}</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>{session.code ? `${session.code} · ` : ''}{session.title}</h1>
      <p className="lead">{teachers.join(', ')}</p>

      <section className="section card">
        <div className="eyebrow">Recording</div>
        <h2 style={{ fontSize: 32 }}>Watch or listen</h2>
        <div className="actions">
          {session.recording_url ? <a className="button red" href={session.recording_url} target="_blank" rel="noreferrer">Open recording</a> : <span className="meta">Recording coming soon.</span>}
          {session.audio_url ? <audio controls src={session.audio_url} /> : null}
        </div>
      </section>

      <section className="grid two section">
        <div className={progress?.completed_at ? 'card completed' : 'card'}>
          <div className="eyebrow">Progress</div>
          <h3>{progress?.completed_at ? '✓ Completed' : 'Mark this session complete'}</h3>
          {userId ? (
            progress?.completed_at ? <p className="meta">You can revisit this class anytime.</p> : (
              <form action={markSessionComplete.bind(null, session.id, returnPath)}>
                <button className="button sage" type="submit">Mark Complete</button>
              </form>
            )
          ) : (
            <div className="actions"><Link className="button" href="/login">Sign in to save progress</Link></div>
          )}
        </div>

        <div className="card">
          <div className="eyebrow">Private note</div>
          <h3>Save something for later</h3>
          {userId ? (
            <form className="form-stack" action={saveSessionNote.bind(null, session.id, returnPath)}>
              <textarea className="input" name="note" rows={5} placeholder="Write a private study note…" required />
              <button className="button" type="submit">Save note</button>
            </form>
          ) : (
            <div className="actions"><Link className="button" href="/login">Sign in to save notes</Link></div>
          )}
        </div>
      </section>

      {userId && (notes ?? []).length > 0 && (
        <section className="section card">
          <div className="eyebrow">Your Notes</div>
          <div className="list">
            {(notes ?? []).map((note: any) => (
              <div key={note.id} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                <div>{note.note}</div>
                <div className="meta">{new Date(note.updated_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section card">
        <div className="eyebrow">Study Notes</div>
        {studyNotes ? (
          <>
            <h2 style={{ fontSize: 32 }}>{studyNotes.title}</h2>
            {studyNotes.summary && <p className="lead" style={{ fontSize: 17 }}>{studyNotes.summary}</p>}
            <div style={{ whiteSpace: 'pre-wrap' }}>{studyNotes.content_markdown}</div>
            <p className="meta" style={{ marginTop: 18 }}>{studyNotes.disclaimer}</p>
          </>
        ) : <p className="meta">Study Notes have not been published for this session yet.</p>}
      </section>

      <section className="section card">
        <div className="eyebrow">Reference Transcript</div>
        {transcript ? (
          <>
            <h2 style={{ fontSize: 32 }}>{transcript.title}</h2>
            <p className="meta">{transcript.disclaimer}</p>
            <p>The paragraph reader will appear here after the transcript importer is connected.</p>
          </>
        ) : <p className="meta">Reference transcript has not been uploaded for this session yet.</p>}
      </section>

      <section className="section">
        <Link className="button" href={`/courses/${courseSlug}/${offeringSlug}`}>← Back to {session.course_offerings.label}</Link>
      </section>
    </main>
  )
}
