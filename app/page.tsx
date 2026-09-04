import Link from 'next/link'
import UpcomingCourses from '@/components/upcoming-courses'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'
import rawCourse18Schedule from '@/content/classics/course-18-schedule.json'
import rawCourseData from '@/content/classics/course-08/taiwan-2026.json'

type CourseData = {
  course: { canonicalNumber: number; title: string; fullTitle: string }
  offering: { label: string; location: string; startsOn: string; endsOn: string; languages: string[]; teachers: string[] }
}
type CatalogCourse = { canonicalNumber: number; slug: string; title: string }
type ArchiveCourse = { canonicalNumber: number; schedule?: Array<{ label: string; date: string }> }
type ArchiveCatalog = { courses: ArchiveCourse[] }
type DetailedSchedule = { sessions: Array<{ id: string; label: string; startsAt: string; endsAt: string }> }

const courseData = rawCourseData as CourseData
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

function archiveDateRange(startsOn: string, endsOn: string) {
  const start = new Date(`${startsOn}T12:00:00Z`)
  const end = new Date(`${endsOn}T12:00:00Z`)
  const month = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(start)
  return `${month} ${start.getUTCDate()}–${end.getUTCDate()}, ${end.getUTCFullYear()}`
}

export default function HomePage() {
  const { course, offering } = courseData
  const archiveHref = '/courses/course-8/taiwan-2026'

  return (
    <main>
      <section className="hero home-v12-hero"><div className="container"><div className="eyebrow">Teaching library</div><h1>Study the teachings.</h1><p>Browse Classics Courses, recordings, Study Notes, Reference Transcripts, meditations, and course materials in one calm study space.</p><div className="actions" style={{ marginTop: 22 }}><Link className="button sage" href="/courses">Browse Classics Courses</Link><Link className="button" href="/search">Search the Library</Link></div></div></section>

      <UpcomingCourses courses={upcomingCourses} />

      <section className="container section">
        <div className="section-head"><div><div className="eyebrow">Latest teaching</div><h2>Classics Course {course.canonicalNumber} · {offering.label}</h2><p>The first Course Offering being migrated into the GitHub-backed Library.</p></div></div>
        <div className="home-current-grid">
          <Link className="home-active-course" href={archiveHref}><div className="home-active-artwork placeholder" aria-hidden="true" /><div className="home-active-copy"><div className="eyebrow">Classics Course {course.canonicalNumber}</div><h2>{course.title}</h2><p>{offering.teachers.join(' and ')} · {archiveDateRange(offering.startsOn, offering.endsOn)} · {offering.location}</p><span className="button sage home-active-button">Open Course 8</span></div></Link>
          <div className="card"><div className="eyebrow">Search the archive</div><h2>Find the exact passage.</h2><p className="meta">Search across the migrated transcripts and available Study Notes. Transcript results open directly at the matching paragraph.</p><div className="actions" style={{ marginTop: 18 }}><Link className="button sage" href="/search">Search teachings</Link></div></div>
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
