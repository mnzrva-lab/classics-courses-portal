import Link from 'next/link'
import UpcomingCourses from '@/components/upcoming-courses'
import { readPublishedJSON } from '@/lib/public-content'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'
import rawCourse18Schedule from '@/content/classics/course-18-schedule.json'

type CatalogCourse = { canonicalNumber: number; slug: string; title: string; artwork?: string | null }
type ArchiveCourse = { canonicalNumber: number; schedule?: Array<{ label: string; date: string }> }
type ArchiveCatalog = { courses: ArchiveCourse[] }
type DetailedSession = { id: string; label: string; startsAt: string; endsAt: string; rebroadcastAt?: string }
type DetailedSchedule = {
  schemaVersion: number
  course: number
  sourceTimezone: string
  sourceLabel: string
  sessions: DetailedSession[]
}

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

const catalog = rawCatalog as CatalogCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog
const fallbackCourse18Schedule = rawCourse18Schedule as DetailedSchedule
const courseByNumber = new Map(catalog.map((course) => [course.canonicalNumber, course]))

function isCourse18Schedule(candidate: unknown): candidate is DetailedSchedule {
  if (!candidate || typeof candidate !== 'object') return false
  const schedule = candidate as Partial<DetailedSchedule>
  if (schedule.schemaVersion !== 1 || schedule.course !== 18) return false
  if (schedule.sourceTimezone !== 'America/Phoenix' || typeof schedule.sourceLabel !== 'string') return false
  if (!Array.isArray(schedule.sessions) || schedule.sessions.length === 0 || schedule.sessions.length > 30) return false

  const ids = new Set<string>()
  for (const value of schedule.sessions as unknown[]) {
    if (!value || typeof value !== 'object') return false
    const session = value as Partial<DetailedSession>
    if (typeof session.id !== 'string' || !session.id.trim() || ids.has(session.id)) return false
    if (typeof session.label !== 'string' || !session.label.trim()) return false
    if (typeof session.startsAt !== 'string' || !session.startsAt.endsWith('Z')) return false
    if (typeof session.endsAt !== 'string' || !session.endsAt.endsWith('Z')) return false
    const start = Date.parse(session.startsAt)
    const end = Date.parse(session.endsAt)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false
    if (session.rebroadcastAt !== undefined &&
        (typeof session.rebroadcastAt !== 'string' || !Number.isFinite(Date.parse(session.rebroadcastAt)))) return false
    ids.add(session.id)
  }
  return true
}

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
  courseNumber: number
  title: string
  href: string
  artwork: string | null
  sessions: FeaturedUpcomingSession[]
}

function getUpcomingCourses(course18Schedule: DetailedSchedule): FeaturedUpcomingCourse[] {
  return archiveCatalog.courses.flatMap((archive): FeaturedUpcomingCourse[] => {
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
}

const latestCourses: LatestCourse[] = [
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
  const remoteSchedule = await readPublishedJSON('classics/course-18/schedule.json', isCourse18Schedule)
  const upcomingCourses = getUpcomingCourses(remoteSchedule ?? fallbackCourse18Schedule)

  return (
    <main>
      <section className="hero home-v12-hero"><div className="container"><div className="eyebrow">Teaching library</div><h1>Study the teachings.</h1><p>Browse Classics Courses, recordings, Study Notes, Reference Transcripts, meditations, and course materials in one calm study space.</p><div className="actions" style={{ marginTop: 22 }}><Link className="button sage" href="/courses">Browse Classics Courses</Link><Link className="button" href="/search">Search the Library</Link></div></div></section>

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
