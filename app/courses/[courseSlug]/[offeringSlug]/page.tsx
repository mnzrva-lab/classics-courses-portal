import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LiveCourseSchedule from '@/components/live-course-schedule'
import OfferingSessionList from '@/components/offering-session-list'
import { toggleCourseBookmark } from './actions'

export const dynamic = 'force-dynamic'

type CourseRelation = {
  id: string
  slug: string
  title: string
  canonical_number: number | null
  status: string
}

function materialLabel(type: string) {
  const labels: Record<string, string> = {
    reading: 'Reading',
    slides: 'Slides',
    audio: 'Audio',
    video: 'Video',
    document: 'Document',
    link: 'Link',
    other: 'Material',
  }
  return labels[type] ?? 'Material'
}

function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return null
  const fmt = (value: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
  if (!start) return fmt(end!)
  if (!end || start === end) return fmt(start)
  const s = new Date(`${start}T12:00:00Z`)
  const e = new Date(`${end}T12:00:00Z`)
  if (s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth()) {
    const month = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(s)
    return `${month} ${s.getUTCDate()}–${e.getUTCDate()}, ${e.getUTCFullYear()}`
  }
  return `${fmt(start)} – ${fmt(end)}`
}

function isYouTubePlaylist(url: string | null | undefined) {
  if (!url) return false
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    return (host === 'youtube.com' || host === 'm.youtube.com') && parsed.searchParams.has('list')
  } catch {
    return false
  }
}

export default async function CourseOfferingPage({
  params,
}: {
  params: Promise<{ courseSlug: string; offeringSlug: string }>
}) {
  const { courseSlug, offeringSlug } = await params
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  const { data: offering } = await supabase
    .from('course_offerings')
    .select('id, slug, label, location, year, language_codes, artwork_url, description, starts_on, ends_on, status, courses!inner(id, slug, title, canonical_number, status)')
    .eq('slug', offeringSlug)
    .eq('status', 'published')
    .eq('courses.slug', courseSlug)
    .eq('courses.status', 'published')
    .single()

  if (!offering) notFound()
  const course = offering.courses as unknown as CourseRelation

  const [sessionsResult, offeringMaterialsResult, bookmarkResult, settingsResult] = await Promise.all([
    supabase
      .from('sessions')
      .select(`
        id, slug, code, title, session_type, session_date, starts_at, ends_at, source_timezone, recording_url, zoom_url, sort_order,
        session_teachers(teachers(full_name)),
        transcripts(status),
        study_notes(status),
        materials(material_type, status)
      `)
      .eq('offering_id', offering.id)
      .eq('status', 'published')
      .order('sort_order'),
    supabase
      .from('materials')
      .select('id, title, material_type, mime_type, url, storage_bucket, storage_path')
      .eq('offering_id', offering.id)
      .is('session_id', null)
      .eq('status', 'published')
      .order('sort_order'),
    userId
      ? supabase.from('user_course_bookmarks').select('course_id').eq('user_id', userId).eq('course_id', course.id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    userId
      ? supabase.from('user_settings').select('save_bookmarks, save_progress').eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ])

  const sessions = sessionsResult.data ?? []
  const sessionIds = sessions.map((session: any) => session.id)
  const progressResult = userId && sessionIds.length
    ? await supabase.from('user_session_progress').select('session_id, started_at, completed_at').eq('user_id', userId).in('session_id', sessionIds)
    : { data: [] as any[] }
  const progressMap = new Map((progressResult.data ?? []).map((row: any) => [row.session_id, row]))
  const completedCount = sessions.filter((session: any) => progressMap.get(session.id)?.completed_at).length
  const progressPercent = sessions.length ? Math.round((completedCount / sessions.length) * 100) : 0
  const canSaveBookmarks = settingsResult.data?.save_bookmarks ?? true
  const courseBookmarked = Boolean(bookmarkResult.data)

  const resolvedOfferingMaterials = await Promise.all((offeringMaterialsResult.data ?? []).map(async (material: any) => {
    if (material.storage_bucket && material.storage_path) {
      const { data } = await supabase.storage.from(material.storage_bucket).createSignedUrl(material.storage_path, 60 * 60)
      return { ...material, resolved_url: data?.signedUrl ?? null }
    }
    return { ...material, resolved_url: material.url ?? null }
  }))

  const teacherNames = Array.from(new Set(sessions.flatMap((session: any) =>
    (session.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean)
  ))) as string[]

  let classIndex = 0
  let meditationIndex = 0
  const sessionCards = sessions.map((session: any) => {
    if (session.session_type === 'meditation') meditationIndex += 1
    else if (session.session_type === 'class') classIndex += 1
    const autoCode = session.session_type === 'meditation' ? `M${meditationIndex}` : session.session_type === 'class' ? `C${classIndex}` : session.code || '•'
    const transcriptPublished = (session.transcripts ?? []).some((item: any) => item.status === 'published')
    const notesPublished = (session.study_notes ?? []).some((item: any) => item.status === 'published')
    const materialBadges = Array.from(new Set((session.materials ?? [])
      .filter((item: any) => item.status === 'published')
      .map((item: any) => materialLabel(item.material_type)))) as string[]
    const badges = [
      session.recording_url ? 'Recording' : null,
      notesPublished ? 'Study Notes' : null,
      transcriptPublished ? 'Transcript' : null,
      ...materialBadges,
    ].filter(Boolean) as string[]
    const progress = progressMap.get(session.id) as any
    return {
      id: session.id,
      href: `/courses/${courseSlug}/${offeringSlug}/${session.slug}`,
      code: session.code || autoCode,
      title: session.title,
      sessionType: session.session_type,
      sessionDate: session.session_date,
      teacherNames: (session.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean),
      completed: Boolean(progress?.completed_at),
      inProgress: Boolean(progress?.started_at && !progress?.completed_at),
      badges,
    }
  })

  const liveScheduleSessions = sessions.map((session: any) => ({
    id: session.id,
    code: session.code,
    title: session.title,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    sourceTimezone: session.source_timezone,
    zoomUrl: session.zoom_url,
    teacherNames: (session.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean),
  }))
  const playlistSession = sessions.find((session: any) => isYouTubePlaylist(session.recording_url)) as any
  const publicPath = `/courses/${courseSlug}/${offeringSlug}`
  const today = new Date().toISOString().slice(0, 10)
  const hasScheduledSessions = liveScheduleSessions.some((session) => session.startsAt)
  const showLiveSchedule = hasScheduledSessions && (!offering.ends_on || offering.ends_on >= today)
  const hasCourseResources = resolvedOfferingMaterials.some((material: any) => Boolean(material.resolved_url)) || Boolean(playlistSession?.recording_url)

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/courses">Classics Courses</Link><span>/</span>
        <span>{course.canonical_number ? `Course ${course.canonical_number}` : course.title}</span><span>/</span>
        <span>{offering.label}</span>
      </div>

      <section className={offering.artwork_url ? 'offering-hero' : 'offering-hero no-artwork'}>
        <div className="offering-hero-copy">
          <div className="eyebrow">{course.canonical_number ? `Classics Course ${course.canonical_number}` : course.title} · {offering.label}</div>
          <h1 className="offering-title">{course.title}</h1>
          {teacherNames.length ? <p className="lead">with {teacherNames.join(' and ')}</p> : null}
          {offering.description ? <p className="lead offering-description">{offering.description}</p> : null}
          <div className="offering-meta">
            {formatRange(offering.starts_on, offering.ends_on) ? <span className="pill">{formatRange(offering.starts_on, offering.ends_on)}</span> : null}
            {offering.location ? <span className="pill">{offering.location}</span> : null}
            {(offering.language_codes ?? []).length ? <span className="pill">{(offering.language_codes ?? []).map((code: string) => code.toUpperCase()).join(' · ')}</span> : null}
          </div>
        </div>
        {offering.artwork_url ? (
          <div className="offering-artwork" style={{ backgroundImage: `linear-gradient(rgba(31,27,24,.12), rgba(31,27,24,.18)), url(${offering.artwork_url})` }}>
            <img src={offering.artwork_url} alt="" />
          </div>
        ) : null}
      </section>

      {showLiveSchedule ? (
        <div className="offering-live-full">
          <LiveCourseSchedule sessions={liveScheduleSessions} calendarHref={`${publicPath}/calendar`} />
        </div>
      ) : null}

      <section className="section offering-study-strip">
        <div>
          <div className="eyebrow">Your study</div>
          <strong>{completedCount} of {sessions.length} sessions completed</strong>
        </div>
        <div className="offering-progress-line" aria-label={`${progressPercent}% complete`}><span style={{ width: `${progressPercent}%` }} /></div>
        <strong>{progressPercent}%</strong>
        <div className="actions">
          {userId && (canSaveBookmarks || courseBookmarked) ? (
            <form action={toggleCourseBookmark.bind(null, course.id, publicPath)}>
              <button className="button" type="submit">{courseBookmarked ? '★ Bookmarked' : '☆ Bookmark course'}</button>
            </form>
          ) : !userId ? <Link className="button" href="/login">Sign in to save progress</Link> : null}
        </div>
      </section>

      {hasCourseResources ? (
        <section className="course-resources-row" aria-label="Course resources">
          <div className="course-resources-heading">
            <div className="eyebrow">Course resources</div>
            <strong>Reading &amp; recordings</strong>
          </div>
          <div className="course-resource-buttons">
            {resolvedOfferingMaterials.map((material: any) => material.resolved_url ? (
              <a className="button course-resource-button" key={material.id} href={material.resolved_url} target="_blank" rel="noreferrer">
                {materialLabel(material.material_type)} · {material.title} ↗
              </a>
            ) : null)}
            {playlistSession?.recording_url ? (
              <a className="button course-resource-button" href={playlistSession.recording_url} target="_blank" rel="noreferrer">
                Playlist · Course recordings ↗
              </a>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="offering-section-head">
          <div>
            <div className="eyebrow">Course content</div>
            <h2>Classes &amp; materials</h2>
            <p>Available recordings, Study Notes, Reference Transcripts, and class materials appear automatically.</p>
          </div>
        </div>
        <OfferingSessionList sessions={sessionCards} />
      </section>
    </main>
  )
}
