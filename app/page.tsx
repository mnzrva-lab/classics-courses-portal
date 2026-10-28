import Link from 'next/link'
import UpcomingCourses from '@/components/upcoming-courses'
import { readPublishedJSON } from '@/lib/public-content'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'
import { getCourse18Schedule, type Course18Schedule } from '@/lib/course18-content'
import { getTerm7Schedule } from '@/lib/term7-content'
import type { WeeklyTermSchedule } from '@/lib/weekly-term-schedule'

type CatalogCourse = { canonicalNumber: number; slug: string; title: string; artwork?: string | null }
type ArchiveCourse = { canonicalNumber: number; schedule?: Array<{ label: string; date: string }> }
type ArchiveCatalog = { courses: ArchiveCourse[] }
type LatestCourse = {
  sortDate: string
  dates: string
  eyebrow: string
  title: string
  detail: string
  href: string
  courseNumber?: number
  artwork?: string | null
}

type LatestCoursesFile = {
  schemaVersion: number
  items: LatestCourse[]
}

function isLatestCoursesFile(candidate: unknown): candidate is LatestCoursesFile {
  if (!candidate || typeof candidate !== 'object') return false
  const data = candidate as Partial<LatestCoursesFile>
  if (data.schemaVersion !== 1 || !Array.isArray(data.items) ||
      data.items.length < 1 || data.items.length > 100) return false

  const seenHrefs = new Set<string>()
  for (const item of data.items as unknown[]) {
    if (!item || typeof item !== 'object') return false
    const course = item as Partial<LatestCourse>

    for (const field of ['dates', 'eyebrow', 'title', 'detail'] as const) {
      if (typeof course[field] !== 'string' || !course[field]?.trim() ||
          course[field]!.length > 400) return false
    }

    const date = course.sortDate
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date) return false

    const href = course.href
    if (typeof href !== 'string' || !/^\/(?!\/)[a-z0-9/_-]+$/i.test(href) ||
        href.includes('..') || seenHrefs.has(href)) return false
    seenHrefs.add(href)

    if (course.courseNumber !== undefined &&
        (!Number.isInteger(course.courseNumber) || course.courseNumber < 1 ||
         course.courseNumber > 100)) return false

    if (course.artwork !== undefined && course.artwork !== null &&
        (typeof course.artwork !== 'string' ||
         !/^\/(?!\/)[a-z0-9/_-]+\.(?:jpg|jpeg|png|webp|svg)$/i.test(course.artwork) ||
         course.artwork.includes('..'))) return false
  }
  return true
}

const catalog = rawCatalog as CatalogCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog
const courseByNumber = new Map(catalog.map((course) => [course.canonicalNumber, course]))

function arizonaDate(iso: string) {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (part: string) => formatted.find((item) => item.type === part)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

type FeaturedUpcomingSession = {
  id: string
  label: string
  date: string
  startsAt: string | null
  endsAt: string | null
}
type FeaturedUpcomingCourse = {
  courseNumber?: number
  programLabel?: string
  title: string
  href: string
  artwork: string | null
  sessions: FeaturedUpcomingSession[]
  recurrence?: WeeklyTermSchedule
}

function getUpcomingCourses(course18Schedule: Course18Schedule, term7Schedule: WeeklyTermSchedule): FeaturedUpcomingCourse[] {
  const classics = archiveCatalog.courses.flatMap((archive): FeaturedUpcomingCourse[] => {
    const course = courseByNumber.get(archive.canonicalNumber)
    if (!course) return []

    // Exact Arizona schedule is read from the private content repository.
    // New sessions added there are included automatically.
    if (archive.canonicalNumber === 18) {
      const sessions = course18Schedule.sessions.map((session) => ({
        id: session.id,
        label: session.label,
        date: arizonaDate(session.startsAt),
        startsAt: session.startsAt,
        endsAt: session.endsAt,
      }))
      return [{
        courseNumber: course.canonicalNumber,
        title: course.title,
        href: `/courses/${course.slug}`,
        artwork: course.artwork ?? null,
        sessions,
      }]
    }

    if (!archive.schedule?.length) return []
    const sessions = archive.schedule.map((session, index) => ({
      id: `course-${archive.canonicalNumber}-${index + 1}`,
      label: session.label,
      date: session.date,
      startsAt: null,
      endsAt: null,
    }))
    return [{
      courseNumber: course.canonicalNumber,
      title: course.title,
      href: `/courses/${course.slug}`,
      artwork: course.artwork ?? null,
      sessions,
    }]
  })
  return [...classics, {
    programLabel: 'Living Lam Rim · Term 7',
    title: term7Schedule.title,
    href: '/living-lam-rim/term-7',
    artwork: null,
    sessions: [],
    recurrence: term7Schedule,
  }]
}

const fallbackLatestCourses: LatestCourse[] = [
  {
    sortDate: '2026-09-12',
    dates: 'Sep 11–12, 2026',
    eyebrow: 'Other Program · Casa Tartuk',
    title: 'The Eye of Courage: Blindspots & Leadership',
    detail: 'Timothy Lowenhaupt · Guadalajara',
    href: '/other-programs/eye-of-courage',
    artwork: '/eye-of-courage/cover.jpg',
  },
  {
    sortDate: '2026-08-22',
    dates: 'Aug 18–22, 2026',
    eyebrow: 'Classics Course 8 · Taiwan 2026',
    title: 'Death and the Realms of Existence',
    detail: 'Timothy Lowenhaupt & Brian Mendoza · Online from Taiwan',
    href: '/courses/course-8/taiwan-2026',
    courseNumber: 8,
  },
  {
    sortDate: '2026-08-23',
    dates: 'Apr 26–Aug 23, 2026',
    eyebrow: 'Classics Course 17 · Arizona 2026',
    title: 'The Great Ideas of Buddhism, Part II',
    detail: 'Timothy Lowenhaupt',
    href: '/courses/course-17/current-2026',
    courseNumber: 17,
  },
  {
    sortDate: '2026-04-05',
    dates: 'Mar 31–Apr 5, 2026',
    eyebrow: 'Classics Course 7 · Taiwan 2026',
    title: 'The Bodhisattva Vows',
    detail: 'Timothy Lowenhaupt',
    href: '/courses/course-7',
    courseNumber: 7,
  },
  {
    sortDate: '2026-03-22',
    dates: 'Nov 9, 2025–Mar 22, 2026',
    eyebrow: 'Classics Course 16 · Arizona 2025–2026',
    title: 'The Great Ideas of Buddhism, Part I',
    detail: 'Timothy Lowenhaupt',
    href: '/courses/course-16',
    courseNumber: 16,
  },
].sort((a, b) => b.sortDate.localeCompare(a.sortDate)).slice(0, 5)

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [course18Schedule, term7Schedule, remoteLatest] = await Promise.all([
    getCourse18Schedule(),
    getTerm7Schedule(),
    readPublishedJSON('home/latest-courses.json', isLatestCoursesFile),
  ])
  const upcomingCourses = getUpcomingCourses(course18Schedule, term7Schedule)
  const latestCourses = (remoteLatest?.items ?? fallbackLatestCourses)
    .slice()
    .sort((a, b) => b.sortDate.localeCompare(a.sortDate))
    .slice(0, 5)

  return (
    <main>
      <UpcomingCourses courses={upcomingCourses} />

      <section className="container section">
        <div className="section-head"><div><div className="eyebrow">Recently taught</div><h2>Latest courses</h2><p>Newest first, based on the final teaching date.</p></div></div>
        <div className="home-milestones">
          {latestCourses.map((course) => {
            const artwork = course.artwork ?? (course.courseNumber ? courseByNumber.get(course.courseNumber)?.artwork : null)
            return (
              <Link className="home-milestone-row" href={course.href} key={`${course.sortDate}-${course.title}`}>
                <div
                  className={artwork ? 'home-milestone-artwork has-artwork' : 'home-milestone-artwork placeholder'}
                  style={artwork ? { backgroundImage: `url("${artwork}")` } : undefined}
                  aria-hidden="true"
                >
                  {!artwork ? <span>{course.courseNumber ? `C${course.courseNumber}` : 'Library'}</span> : null}
                </div>
                <div className="home-milestone-date">{course.dates}</div>
                <div className="home-milestone-copy">
                  <div className="eyebrow">{course.eyebrow}</div>
                  <h3>{course.title}</h3>
                  <p>{course.detail}</p>
                </div>
                <span className="home-open-pill">Open</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="container section">
        <div className="section-head"><div><h2>Explore</h2></div></div>
        <div className="home-explore-grid">
          <Link className="card home-library-card" href="/courses"><div className="eyebrow">18 courses</div><h3>Classics Courses</h3><p className="meta">The full Classics curriculum, with Course Offerings added course by course.</p><div className="go">Browse all 18 →</div></Link>
          <Link className="card home-library-card" href="/living-lam-rim"><div className="eyebrow">Steps on the Path Course</div><h3>Living Lam Rim</h3><p className="meta">Move term by term through meditation and insight teachings, with each class kept as its own study page.</p><div className="go">Open terms →</div></Link>
          <Link className="card home-library-card" href="/perfection-of-wisdom"><div className="eyebrow">Diamond Cutter Classics series</div><h3>Perfection of Wisdom</h3><p className="meta">Study the long-running text and commentary project through its teaching periods and individual sessions.</p><div className="go">Continue study →</div></Link>
          <Link className="card home-library-card" href="/meditations"><div className="eyebrow">Practice library</div><h3>Meditations</h3><p className="meta">Find meditation recordings by duration while keeping their original course context visible.</p><div className="go">Find a meditation →</div></Link>
        </div>
      </section>
    </main>
  )
}
