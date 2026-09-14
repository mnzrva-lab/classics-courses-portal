import Link from 'next/link'
import UpcomingCourses from '@/components/upcoming-courses'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'
import rawCourse18Schedule from '@/content/classics/course-18-schedule.json'

type CatalogCourse = { canonicalNumber: number; slug: string; title: string }
type ArchiveCourse = { canonicalNumber: number; schedule?: Array<{ label: string; date: string }> }
type ArchiveCatalog = { courses: ArchiveCourse[] }
type DetailedSchedule = { sessions: Array<{ id: string; label: string; startsAt: string; endsAt: string }> }

type LatestCourse = {
  sortDate: string
  dates: string
  eyebrow: string
  title: string
  detail: string
  href: string
}

const catalog = rawCatalog as CatalogCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog
const course18Schedule = rawCourse18Schedule as DetailedSchedule
const courseByNumber = new Map(catalog.map((course) => [course.canonicalNumber, course]))

const upcomingCourses = archiveCatalog.courses.flatMap((archive) => {
  if (!archive.schedule?.length) return []
  const course = courseByNumber.get(archive.canonicalNumber)
  if (!course) return []

  const detailed = archive.canonicalNumber === 18 ? course18Schedule.sessions : []
  const detailedByLabel = new Map(detailed.map((session) => [session.label.replace(' & ', '–'), session]))
  const sessions = archive.schedule.map((session, index) => {
    const exact = detailed[index] ?? detailedByLabel.get(session.label)
    return {
      id: exact?.id ?? `course-${archive.canonicalNumber}-${index + 1}`,
      label: exact?.label ?? session.label,
      date: session.date,
      startsAt: exact?.startsAt ?? null,
      endsAt: exact?.endsAt ?? null,
    }
  })

  return [{ courseNumber: course.canonicalNumber, title: course.title, href: `/courses/${course.slug}`, sessions }]
})

const latestCourses: LatestCourse[] = [
  {
    sortDate: '2026-09-12',
    dates: 'Sep 11–12, 2026',
    eyebrow: 'Other Program · Casa Tartuk',
    title: 'The Eye of Courage: Blindspots & Leadership',
    detail: 'Timothy Lowenhaupt · Guadalajara',
    href: '/other-programs/eye-of-courage',
  },
  {
    sortDate: '2026-08-22',
    dates: 'Aug 18–22, 2026',
    eyebrow: 'Classics Course 8 · Taiwan 2026',
    title: 'Death and the Realms of Existence',
    detail: 'Timothy Lowenhaupt & Brian Mendoza · Online from Taiwan',
    href: '/courses/course-8/taiwan-2026',
  },
  {
    sortDate: '2026-08-23',
    dates: 'Apr 26–Aug 23, 2026',
    eyebrow: 'Classics Course 17 · Arizona 2026',
    title: 'The Great Ideas of Buddhism, Part II',
    detail: 'Timothy Lowenhaupt',
    href: '/courses/course-17/current-2026',
  },
  {
    sortDate: '2026-04-05',
    dates: 'Mar 31–Apr 5, 2026',
    eyebrow: 'Classics Course 7 · Taiwan 2026',
    title: 'The Bodhisattva Vows',
    detail: 'Timothy Lowenhaupt',
    href: '/courses/course-7',
  },
  {
    sortDate: '2026-03-22',
    dates: 'Nov 9, 2025–Mar 22, 2026',
    eyebrow: 'Classics Course 16 · Arizona 2025–2026',
    title: 'The Great Ideas of Buddhism, Part I',
    detail: 'Timothy Lowenhaupt',
    href: '/courses/course-16',
  },
].sort((a, b) => b.sortDate.localeCompare(a.sortDate)).slice(0, 5)

export default function HomePage() {
  return (
    <main>
      <section className="hero home-v12-hero"><div className="container"><div className="eyebrow">Teaching library</div><h1>Study the teachings.</h1><p>Browse Classics Courses, recordings, Study Notes, Reference Transcripts, meditations, and course materials in one calm study space.</p><div className="actions" style={{ marginTop: 22 }}><Link className="button sage" href="/courses">Browse Classics Courses</Link><Link className="button" href="/search">Search the Library</Link></div></div></section>

      <UpcomingCourses courses={upcomingCourses} />

      <section className="container section">
        <div className="section-head"><div><div className="eyebrow">Recently taught</div><h2>Latest courses</h2><p>Newest first, based on the final teaching date.</p></div></div>
        <div className="home-milestones">
          {latestCourses.map((course) => (
            <Link className="home-milestone-row" href={course.href} key={`${course.sortDate}-${course.title}`}>
              <div className="home-milestone-date">{course.dates}</div>
              <div>
                <div className="eyebrow">{course.eyebrow}</div>
                <h3>{course.title}</h3>
                <p>{course.detail}</p>
              </div>
              <span className="home-open-pill">Open</span>
            </Link>
          ))}
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
