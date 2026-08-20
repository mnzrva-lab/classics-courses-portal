import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function formatSourceTime(value: string | null, timeZone: string | null) {
  if (!value) return 'Time to be added'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default async function OfferingPage({ params }: { params: Promise<{ courseSlug: string; offeringSlug: string }> }) {
  const { courseSlug, offeringSlug } = await params
  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, canonical_number, title, subtitle, description')
    .eq('slug', courseSlug)
    .eq('status', 'published')
    .single()

  if (!course) notFound()

  const { data: offering } = await supabase
    .from('course_offerings')
    .select('id, label, location, year, starts_on, ends_on, language_codes, telegram_url')
    .eq('course_id', course.id)
    .eq('slug', offeringSlug)
    .eq('status', 'published')
    .single()

  if (!offering) notFound()

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, slug, code, title, session_type, starts_at, ends_at, source_timezone, recording_url,
      session_teachers(teachers(full_name))
    `)
    .eq('offering_id', offering.id)
    .eq('status', 'published')
    .order('sort_order', { ascending: true })

  return (
    <main className="container page">
      <div className="eyebrow">Classics Course {course.canonical_number}</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>{course.title}</h1>
      <div className="actions">
        <span className="pill">{offering.label}</span>
        {offering.language_codes?.length ? <span className="pill">{offering.language_codes.join(' · ').toUpperCase()}</span> : null}
      </div>

      <section className="section grid two">
        <div className="card sage">
          <div className="eyebrow">Course Offering</div>
          <h3>{offering.label}</h3>
          <p className="meta">
            {offering.starts_on} to {offering.ends_on}
          </p>
        </div>
        <div className="card">
          <div className="eyebrow">Your study</div>
          <h3>Save progress and notes</h3>
          <p className="meta">Sign in when you want completion, bookmarks, and private notes to follow you across devices.</p>
          <div className="actions"><Link className="button" href="/login">Sign in</Link></div>
        </div>
      </section>

      <section className="section card">
        <div className="eyebrow">Sessions</div>
        <h2>Course schedule</h2>
        <div className="list">
          {(sessions ?? []).map((session: any) => {
            const teachers = (session.session_teachers ?? []).map((x: any) => x.teachers?.full_name).filter(Boolean)
            return (
              <div className="row" key={session.id}>
                <div className="session-code">{session.code || '•'}</div>
                <div>
                  <strong>{session.title}</strong>
                  <div className="meta">{teachers.join(', ') || 'Teacher to be added'} · {formatSourceTime(session.starts_at, session.source_timezone)} source time</div>
                </div>
                <div className="actions" style={{ marginTop: 0 }}>
                  {session.recording_url ? <a className="button" href={session.recording_url} target="_blank" rel="noreferrer">Recording</a> : <span className="meta">Recording coming soon</span>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {offering.telegram_url && (
        <section className="section card">
          <h3>Course updates</h3>
          <p className="meta">Telegram is kept here at the end of the course page so it does not compete with the learning flow.</p>
          <div className="actions"><a className="button" href={offering.telegram_url} target="_blank" rel="noreferrer">Open Telegram updates</a></div>
        </section>
      )}
    </main>
  )
}
