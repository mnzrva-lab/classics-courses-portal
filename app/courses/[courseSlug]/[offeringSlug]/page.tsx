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

function materialLabel(type: string) {
  const labels: Record<string, string> = {
    reading: 'Reading',
    slides: 'Slides',
    audio: 'Audio',
    video: 'Video',
    document: 'Document',
    link: 'Link',
    other: 'Resource',
  }
  return labels[type] ?? 'Resource'
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

  const [{ data: sessions }, { data: materialRows }, { data: claimsData }] = await Promise.all([
    supabase
      .from('sessions')
      .select(`
        id, slug, code, title, session_type, starts_at, ends_at, source_timezone, recording_url, required_for_completion,
        session_teachers(teachers(full_name))
      `)
      .eq('offering_id', offering.id)
      .eq('status', 'published')
      .order('sort_order', { ascending: true }),
    supabase
      .from('materials')
      .select('id, material_type, title, url, mime_type, storage_bucket, storage_path, sort_order')
      .eq('offering_id', offering.id)
      .is('session_id', null)
      .eq('status', 'published')
      .order('sort_order'),
    supabase.auth.getClaims(),
  ])

  const offeringMaterials = await Promise.all((materialRows ?? []).map(async (material: any) => {
    if (material.storage_bucket && material.storage_path) {
      const { data } = await supabase.storage.from(material.storage_bucket).createSignedUrl(material.storage_path, 60 * 60)
      return { ...material, resolved_url: data?.signedUrl ?? null }
    }
    return { ...material, resolved_url: material.url ?? null }
  }))

  const userId = claimsData?.claims?.sub as string | undefined
  const returnPath = `/courses/${courseSlug}/${offeringSlug}`
  let bookmarked = false
  const progressBySession = new Map<string, { completed_at: string | null; last_opened_at: string | null }>()

  if (userId) {
    const sessionIds = (sessions ?? []).map((session: any) => session.id)
    const [{ data: bookmark }, progressResult] = await Promise.all([
      supabase
        .from('user_course_bookmarks')
        .select('course_id')
        .eq('user_id', userId)
        .eq('course_id', course.id)
        .maybeSingle(),
      sessionIds.length
        ? supabase
          .from('user_session_progress')
          .select('session_id, completed_at, last_opened_at')
          .eq('user_id', userId)
          .in('session_id', sessionIds)
        : Promise.resolve({ data: [] } as any),
    ])
    bookmarked = Boolean(bookmark)
    for (const item of progressResult.data ?? []) {
      progressBySession.set(item.session_id, { completed_at: item.completed_at, last_opened_at: item.last_opened_at })
    }
  }

  const requiredSessions = (sessions ?? []).filter((session: any) => session.required_for_completion)
  const completedRequired = requiredSessions.filter((session: any) => progressBySession.get(session.id)?.completed_at).length
  const offeringCompleted = requiredSessions.length > 0 && completedRequired === requiredSessions.length
  const progressPercent = requiredSessions.length ? Math.round((completedRequired / requiredSessions.length) * 100) : 0

  const startsOn = formatDate(offering.starts_on)
  const endsOn = formatDate(offering.ends_on)
  const dateRange = startsOn && endsOn ? `${startsOn} to ${endsOn}` : startsOn ?? endsOn
  const eyebrow = course.canonical_number ? `Classics Course ${course.canonical_number}` : course.kind === 'living_lam_rim' ? 'Living Lam Rim' : 'Program'
  const description = offering.description ?? course.description

  return (
    <main className="container page">
      <div className="offering-breadcrumbs" aria-label="Breadcrumb">
        <Link href="/courses">Classics Courses</Link>
        <span>/</span>
        <span>{offering.label}</span>
      </div>

      <section className={`offering-hero${offering.artwork_url ? '' : ' no-artwork'}`}>
        <div className="offering-hero-copy">
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="offering-title">{course.title}</h1>
          {course.subtitle ? <p className="lead" style={{ marginTop: -4 }}>{course.subtitle}</p> : null}
          {description ? <p className="lead offering-description">{description}</p> : null}
          <div className="offering-meta">
            <span className="pill">{offering.label}</span>
            {dateRange ? <span className="pill">{dateRange}</span> : null}
            {offering.location ? <span className="pill">{offering.location}</span> : null}
            {offering.language_codes?.length ? <span className="pill">{offering.language_codes.join(' · ').toUpperCase()}</span> : null}
          </div>
        </div>

        {offering.artwork_url ? (
          <div className="offering-artwork">
            <img src={offering.artwork_url} alt={`${course.title} artwork`} />
          </div>
        ) : null}
      </section>

      <section className="offering-summary-grid" aria-label="Course Offering summary">
        <div className="card sage offering-summary-card">
          <div className="eyebrow">Course Offering</div>
          <h3>{offering.label}</h3>
          {dateRange ? <p className="meta">{dateRange}</p> : null}
          {offering.location ? <p className="meta">{offering.location}</p> : null}
          <div className="actions">
            <Link className="button" href={`/courses/${courseSlug}/${offeringSlug}/calendar`}>Add full schedule to calendar</Link>
          </div>
        </div>

        <div className={offeringCompleted ? 'card completed offering-summary-card' : 'card offering-summary-card'}>
          <div className="eyebrow">Your study</div>
          <h3>{userId ? (offeringCompleted ? '✓ Course Offering completed' : 'Your progress') : 'Save progress and notes'}</h3>
          {userId ? (
            <>
              {requiredSessions.length ? (
                <>
                  <div className="offering-progress-line" aria-hidden="true"><span style={{ width: `${progressPercent}%` }} /></div>
                  <p className="meta">{completedRequired} of {requiredSessions.length} required sessions completed. The Path of Classics Master counts the canonical course only once.</p>
                </>
              ) : <p className="meta">Bookmarks, progress, and private notes follow your Google study account across devices.</p>}
              <div className="actions">
                <form action={toggleCourseBookmark.bind(null, course.id, returnPath)}>
                  <button className={bookmarked ? 'button sage' : 'button'} type="submit">{bookmarked ? '✓ Course bookmarked' : 'Bookmark course'}</button>
                </form>
                <Link className="button" href="/my-learning">My Learning</Link>
              </div>
            </>
          ) : (
            <>
              <p className="meta">Anyone can study the course. Sign in only when you want private notes, bookmarks, and progress to follow you across devices.</p>
              <div className="actions"><Link className="button" href="/login">Sign in</Link></div>
            </>
          )}
        </div>
      </section>

      {offeringMaterials.length > 0 ? (
        <section className="section">
          <div className="offering-section-head">
            <div>
              <div className="eyebrow">Course materials</div>
              <h2>Shared resources</h2>
              <p>These materials apply to the whole Course Offering and remain available from each class.</p>
            </div>
          </div>
          <div className="offering-materials">
            {offeringMaterials.map((material: any) => (
              <div className="offering-material-row" key={material.id}>
                <div>
                  <strong>{material.title}</strong>
                  <div className="meta">{materialLabel(material.material_type)}{material.mime_type ? ` · ${material.mime_type}` : ''}</div>
                </div>
                {material.resolved_url ? <a className="button" href={material.resolved_url} target="_blank" rel="noreferrer">Open</a> : <span className="meta">File temporarily unavailable</span>}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="offering-section-head">
          <div>
            <div className="eyebrow">Classes &amp; meditations</div>
            <h2>Course schedule</h2>
            <p>Times are shown in your local timezone by default. Use “Show source time” when you want to compare with the teaching location.</p>
          </div>
        </div>

        <div className="offering-schedule-surface">
          <div className="list">
            {(sessions ?? []).length ? (sessions ?? []).map((session: any) => {
              const teachers = (session.session_teachers ?? []).map((x: any) => x.teachers?.full_name).filter(Boolean)
              const progress = progressBySession.get(session.id)
              const completed = Boolean(progress?.completed_at)
              const inProgress = Boolean(progress && !progress.completed_at)
              return (
                <div className={completed ? 'row completed' : inProgress ? 'row sage' : 'row'} key={session.id}>
                  <div className="session-code">{session.code || '•'}</div>
                  <div>
                    <Link href={`/courses/${courseSlug}/${offeringSlug}/${session.slug}`}><strong>{session.title}</strong></Link>
                    <div className="meta">
                      {teachers.join(', ') || 'Teacher to be added'} · <SessionTime startsAt={session.starts_at} sourceTimezone={session.source_timezone} />
                    </div>
                    {userId ? <div className="meta" style={{ marginTop: 4 }}>{completed ? '✓ Completed' : inProgress ? 'In progress' : 'Not started'}{session.required_for_completion ? ' · Required' : ''}</div> : session.required_for_completion ? <div className="meta" style={{ marginTop: 4 }}>Required</div> : null}
                  </div>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <Link className="button" href={`/courses/${courseSlug}/${offeringSlug}/${session.slug}`}>{completed ? 'Review class' : inProgress ? 'Continue' : 'Open class'}</Link>
                  </div>
                </div>
              )
            }) : <p className="meta">No sessions have been published for this Course Offering yet.</p>}
          </div>
        </div>
      </section>

      {offering.telegram_url && (
        <section className="section card offering-updates">
          <div className="eyebrow">Course updates</div>
          <h3 style={{ marginTop: 10 }}>Telegram</h3>
          <p className="meta">Kept here at the end of the course page so it does not compete with the learning flow.</p>
          <div className="actions"><a className="button" href={offering.telegram_url} target="_blank" rel="noreferrer">Open Telegram updates</a></div>
        </section>
      )}
    </main>
  )
}
