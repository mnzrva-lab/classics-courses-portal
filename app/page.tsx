import Link from 'next/link'
import HomeTodayCard from '@/components/home-today-card'
import NextSessionCard from '@/components/next-session-card'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function dateOnly(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function shortDate(value: string | null, includeYear = false) {
  const date = dateOnly(value)
  if (!date) return null
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', ...(includeYear ? { year: 'numeric' as const } : {}), timeZone: 'UTC' }).format(date)
}

function offeringRange(startsOn: string | null, endsOn: string | null) {
  const start = dateOnly(startsOn)
  const end = dateOnly(endsOn)
  if (!start && !end) return null
  if (!start) return shortDate(endsOn, true)
  if (!end || startsOn === endsOn) return shortDate(startsOn, start.getUTCFullYear() !== new Date().getUTCFullYear())
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth()
  if (sameMonth) {
    const month = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(start)
    return `${month} ${start.getUTCDate()}–${end.getUTCDate()}${sameYear && start.getUTCFullYear() === new Date().getUTCFullYear() ? '' : `, ${end.getUTCFullYear()}`}`
  }
  return `${shortDate(startsOn, !sameYear)} → ${shortDate(endsOn, true)}`
}

export default async function HomePage() {
  const supabase = await createClient()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const recentHorizon = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const nowNextWindowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
  const nowNextWindowEndExclusive = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 6, 1)).toISOString().slice(0, 10)

  const [sessionsResult, offeringsResult, claimsResult, perfectionResult] = await Promise.all([
    supabase.from('sessions').select(`id, slug, code, title, session_type, starts_at, ends_at, zoom_url, offering_id, courses!inner(slug, title, canonical_number, status), course_offerings!inner(slug, label, status), session_teachers(teachers(full_name))`).eq('status', 'published').eq('courses.status', 'published').eq('course_offerings.status', 'published').not('starts_at', 'is', null).gte('starts_at', recentHorizon).order('starts_at', { ascending: true }).limit(80),
    supabase.from('course_offerings').select(`id, slug, label, location, starts_on, ends_on, artwork_url, status, courses!inner(slug, title, canonical_number, status)`).eq('status', 'published').eq('courses.status', 'published').not('starts_on', 'is', null).order('starts_on', { ascending: true }).limit(40),
    supabase.auth.getClaims(),
    supabase.from('courses').select('slug, title, subtitle, course_offerings(slug, label, status, sort_order)').eq('slug', 'perfection-of-wisdom').eq('status', 'published').maybeSingle(),
  ])

  const sessions = (sessionsResult.data ?? []).map((row: any) => {
    const course = row.courses as any
    const offering = row.course_offerings as any
    const courseLabel = course?.canonical_number ? `Classics Course ${course.canonical_number}` : course?.title ?? 'Course'
    return { id: row.id, slug: row.slug, code: row.code, title: row.title, starts_at: row.starts_at, ends_at: row.ends_at, zoom_url: row.zoom_url, offering_id: row.offering_id, course_title: course?.title ?? 'Classics Course', course_label: courseLabel, course_slug: course?.slug, offering_label: offering?.label ?? null, offering_slug: offering?.slug, teacher_names: (row.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean) }
  })

  const offerings = (offeringsResult.data ?? []) as any[]
  const currentOffering = offerings.find((offering) => offering.starts_on <= today && (!offering.ends_on || offering.ends_on >= today))
  const latestOffering = [...offerings].reverse().find((offering) => offering.starts_on <= today)
  const nextOffering = offerings.find((offering) => offering.starts_on > today)
  const activeOffering = currentOffering ?? latestOffering ?? nextOffering ?? null
  const userId = claimsResult.data?.claims?.sub as string | undefined

  let progressPercent: number | null = null
  if (userId && activeOffering) {
    const { data: activeSessions } = await supabase.from('sessions').select('id, required_for_completion').eq('offering_id', activeOffering.id).eq('status', 'published').order('sort_order')
    const rows = (activeSessions ?? []) as any[]
    const required = rows.filter((row) => row.required_for_completion)
    const tracked = required.length ? required : rows
    const ids = tracked.map((row) => row.id)
    if (ids.length) {
      const { data: completedRows } = await supabase.from('user_session_progress').select('session_id, completed_at').eq('user_id', userId).in('session_id', ids).not('completed_at', 'is', null)
      progressPercent = Math.round(((completedRows ?? []).length / ids.length) * 100)
    } else progressPercent = 0
  }

  const perfection = perfectionResult.data as any
  const perfectionOffering = (perfection?.course_offerings ?? []).filter((offering: any) => offering.status === 'published').sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
  const perfectionHref = perfection && perfectionOffering ? `/courses/${perfection.slug}/${perfectionOffering.slug}` : '/perfection-of-wisdom'

  const milestones = offerings.filter((offering) => {
    const start = offering.starts_on as string | null
    if (!start) return false
    const end = (offering.ends_on ?? start) as string
    return start < nowNextWindowEndExclusive && end >= nowNextWindowStart
  }).sort((a, b) => String(a.starts_on).localeCompare(String(b.starts_on)))
  const activeCourse = activeOffering?.courses as any
  const activeHref = activeOffering && activeCourse ? `/courses/${activeCourse.slug}/${activeOffering.slug}` : null
  const activeCourseLabel = activeCourse?.canonical_number ? `Classics Course ${activeCourse.canonical_number}` : activeCourse?.title

  return (
    <main>
      <section className="hero home-v12-hero"><div className="container"><h1>Continue learning.</h1><p>Live class access, recordings, Study Notes, Reference Transcripts, meditations, and course materials in one place.</p></div></section>
      <section className="container section home-next-section"><div className="home-time-note">Schedule times are shown in your local timezone by default.</div><NextSessionCard sessions={sessions} /></section>

      <section className="container home-current-grid">
        {activeOffering && activeCourse && activeHref ? <Link className="home-active-course" href={activeHref}>
          <div className={activeOffering.artwork_url ? 'home-active-artwork' : 'home-active-artwork placeholder'} style={activeOffering.artwork_url ? { backgroundImage: `url(${activeOffering.artwork_url})` } : undefined} aria-hidden="true" />
          <div className="home-active-copy"><div className="eyebrow">{progressPercent != null && progressPercent > 0 ? 'Continue learning' : 'Current course'}</div><h2>{activeCourseLabel} · {activeOffering.label}</h2><p>{activeCourse.title}{offeringRange(activeOffering.starts_on, activeOffering.ends_on) ? ` · ${offeringRange(activeOffering.starts_on, activeOffering.ends_on)}` : ''}{activeOffering.location ? ` · ${activeOffering.location}` : ''}</p>{progressPercent != null ? <><div className="home-progress-row"><div className="home-progress"><span style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} /></div><strong>{progressPercent}%</strong></div><div className="meta">Your progress</div></> : null}<span className="button sage home-active-button">{progressPercent != null && progressPercent > 0 ? 'Continue course' : 'Open course'}</span></div>
        </Link> : <div className="card home-active-course-empty"><div className="eyebrow">Current course</div><h2>Published teaching will appear here.</h2></div>}
        <HomeTodayCard sessions={sessions} />
      </section>

      <section className="container section"><div className="section-head"><div><h2>Now &amp; next</h2><p>Important teaching milestones.</p></div></div><div className="home-milestones">{milestones.length ? milestones.map((offering) => { const course = offering.courses as any; const label = course?.canonical_number ? `Classics Course ${course.canonical_number}` : course?.title ?? 'Course'; return <Link className="home-milestone-row" href={`/courses/${course.slug}/${offering.slug}`} key={offering.id}><strong className="home-milestone-date">{offeringRange(offering.starts_on, offering.ends_on) ?? 'Dates to be announced'}</strong><div><h3>{label}{offering.label ? ` · ${offering.label}` : ''}</h3><p>{course?.title}</p></div><span className="home-open-pill">Open</span></Link> }) : <div className="card"><p className="meta">Upcoming published Course Offerings will appear here.</p></div>}</div></section>

      <section className="container section"><div className="section-head"><div><h2>Explore</h2></div></div><div className="home-explore-grid">
        <Link className="card home-library-card cream" href="/courses"><div className="eyebrow">18 courses</div><h3>Classics Courses</h3><p className="meta">The full Classics curriculum, with teaching archives added course by course.</p><div className="go">Browse all 18 →</div></Link>
        <Link className="card home-library-card sage" href="/living-lam-rim"><div className="eyebrow">Steps on the Path Course</div><h3>Living Lam Rim</h3><p className="meta">Move term by term through meditation and insight teachings, with each class kept as its own study page.</p><div className="go">Open terms →</div></Link>
        <Link className="card home-library-card" href={perfectionHref}><div className="eyebrow">Text study</div><h3>Perfection of Wisdom</h3><p className="meta">Study the long-running text and commentary project through its teaching seasons and individual sessions.</p><div className="go">Continue study →</div></Link>
        <Link className="card home-library-card" href="/meditations"><div className="eyebrow">Practice library</div><h3>Meditations</h3><p className="meta">Find a practice by time first, then refine by topic, teacher, or source when needed.</p><div className="go">Find a meditation →</div></Link>
      </div><div className="home-other-teachings"><Link href="/other-programs">Other teachings and study projects <span aria-hidden="true">→</span></Link><p>For individual classes, smaller study projects, and teachings that do not need to become a main Course Offering.</p></div></section>
    </main>
  )
}
