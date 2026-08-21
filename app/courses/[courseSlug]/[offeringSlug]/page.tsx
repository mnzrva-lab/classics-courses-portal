import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SessionTime from '@/components/session-time'
import { toggleCourseBookmark } from './actions'

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export default async function OfferingPage({ params }: { params: Promise<{ courseSlug: string; offeringSlug: string }> }) {
  const { courseSlug, offeringSlug } = await params
  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, kind, canonical_number, title, subtitle, description')
    .eq('slug', courseSlug)
    .eq('status', 'published')
    .single()

  if (!course) notFound()

  const { data: offering } = await supabase
    .from('course_offerings')
    .select('id, label, location, year, starts_on, ends_on, language_codes, telegram_url, description, artwork_url')
    .eq('course_id', course.id)
    .eq('slug', offeringSlug)
    .eq('status', 'published')
    .single()

  if (!offering) notFound()

  const [{ data: sessions }, { data: claimsData }] = await Promise.all([
    supabase
      .from('sessions')
      .select(`
        id, slug, code, title, session_type, starts_at, ends_at, source_timezone, recording_url,
        session_teachers(teachers(full_name))
      `)
      .eq('offering_id', offering.id)
      .eq('status', 'published')
      .order('sort_order', { ascending: true }),
    supabase.auth.getClaims(),
  ])

  const userId = claimsData?.claims?.sub as string | undefined
  const returnPath = `/courses/${courseSlug}/${offeringSlug}`
  let bookmarked = false

  if (userId) {
    const { data: bookmark } = await supabase
      .from('user_course_bookmarks')
      .select('course_id')
      .eq('user_id', userId)
      .eq('course_id', course.id)
      .maybeSingle()
    bookmarked = Boolean(bookmark)
  }

  const startsOn = formatDate(offering.starts_on)
  const endsOn = formatDate(offering.ends_on)
  const dateRange = startsOn && endsOn ? `${startsOn} to ${endsOn}` : startsOn ?? endsOn
  const eyebrow = course.canonical_number ? `Classics Course ${course.canonical_number}` : course.kind === 'living_lam_rim' ? 'Living Lam Rim' : 'Program'
  const description = offering.description ?? course.description

  return (
    <main className="container page">
      <div className="eyebrow">{eyebrow}</div>

      <section className={offering.artwork_url ? 'grid two' : undefined} style={{ alignItems: 'center', gap: 28 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>{course.title}</h1>
          {course.subtitle ? <p className="lead" style={{ marginTop: -8 }}>{course.subtitle}</p> : null}
          {description ? <p className="lead" style={{ fontSize: 18 }}>{description}</p> : null}
          <div className="actions">
            <span className="pill">{offering.label}</span>
            {dateRange ? <span className="pill">{dateRange}</span> : null}
            {offering.location ? <span className="pill">{offering.location}</span> : null}
            {offering.language_codes?.length ? <span className="pill">{offering.language_codes.join(' · ').toUpperCase()}</span> : null}
          </div>
        </div>
        {offering.artwork_url ? (
          <div className="card" style={{ padding: 10, overflow: 'hidden' }}>
            <img
              src={offering.artwork_url}
              alt={`${course.title} artwork`}
              style={{ width: '100%', maxHeight: 380, objectFit: 'cover', display: 'block', borderRadius: 15 }}
            />
          </div>
        ) : null}
      </section>

      <section className="section grid two">
        <div className="card sage">
          <div className="eyebrow">Course Offering</div>
          <h3>{offering.label}</h3>
          {dateRange ? <p className="meta">{dateRange}</p> : null}
          {offering.location ? <p className="meta">{offering.location}</p> : null}
          <div className="actions">
            <a className="button" href={`/courses/${courseSlug}/${offeringSlug}/calendar`}>Add full schedule to calendar</a>
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">Your study</div>
          <h3>{userId ? 'Save this course for later' : 'Save progress and notes'}</h3>
          {userId ? (
            <>
              <p className="meta">Bookmarks, progress, and private notes follow your Google study account across devices.</p>
              <div className="actions">
                <form action={toggleCourseBookmark.bind(null, course.id, returnPath)}>
                  <button className={bookmarked ? 'button sage' : 'button'} type="submit">{bookmarked ? '✓ Course bookmarked' : 'Bookmark course'}</button>
                </form>
                <Link className="button" href="/my-learning">My Learning</Link>
              </div>
            </>
          ) : (
            <>
              <p className="meta">Sign in when you want completion, bookmarks, and private notes to follow you across devices.</p>
              <div className="actions"><Link className="button" href="/login">Sign in</Link></div>
            </>
          )}
        </div>
      </section>

      <section className="section card">
        <div className="eyebrow">Sessions</div>
        <h2>Course schedule</h2>
        <p className="meta">Times are shown in your local timezone by default. Use “Show source time” when you want to compare with the teaching location.</p>
        <div className="list" style={{ marginTop: 18 }}>
          {(sessions ?? []).length ? (sessions ?? []).map((session: any) => {
            const teachers = (session.session_teachers ?? []).map((x: any) => x.teachers?.full_name).filter(Boolean)
            return (
              <div className="row" key={session.id}>
                <div className="session-code">{session.code || '•'}</div>
                <div>
                  <Link href={`/courses/${courseSlug}/${offeringSlug}/${session.slug}`}><strong>{session.title}</strong></Link>
                  <div className="meta">
                    {teachers.join(', ') || 'Teacher to be added'} · <SessionTime startsAt={session.starts_at} sourceTimezone={session.source_timezone} />
                  </div>
                </div>
                <div className="actions" style={{ marginTop: 0 }}>
                  <Link className="button" href={`/courses/${courseSlug}/${offeringSlug}/${session.slug}`}>Open class</Link>
                </div>
              </div>
            )
          }) : <p className="meta">No sessions have been published for this Course Offering yet.</p>}
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
