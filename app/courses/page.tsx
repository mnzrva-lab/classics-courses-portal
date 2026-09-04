import Link from 'next/link'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'

type CatalogCourse = {
  canonicalNumber: number
  slug: string
  title: string
}

type ArchiveOffering = {
  slug: string
  label: string
  internalHref?: string
}

type ArchiveCourse = {
  canonicalNumber: number
  offerings?: ArchiveOffering[]
  schedule?: Array<{ label: string; date: string }>
}

type ArchiveCatalog = { courses: ArchiveCourse[] }

const catalog = rawCatalog as CatalogCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog
const archiveByNumber = new Map(archiveCatalog.courses.map((course) => [course.canonicalNumber, course]))

function offeringHref(course: CatalogCourse, offering: ArchiveOffering) {
  return offering.internalHref ?? `/courses/${course.slug}/${offering.slug}`
}

function upcomingLabel(schedule: Array<{ label: string; date: string }>) {
  const first = schedule[0]
  if (!first) return 'View schedule'
  const date = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${first.date}T12:00:00Z`))
  return `Upcoming · ${date}`
}

export default function CoursesPage() {
  return (
    <main className="container page classics-library-page">
      <div className="eyebrow">Classics library</div>
      <h1>The 18 Classics Courses</h1>
      <p className="lead">Choose the Course Offering you want to study directly from each course.</p>

      <section className="section classics-card-grid" aria-label="The 18 Classics Courses">
        {catalog.map((course) => {
          const archive = archiveByNumber.get(course.canonicalNumber)
          const offerings = archive?.offerings ?? []
          const schedule = archive?.schedule ?? []

          return (
            <article className="classics-card" key={course.canonicalNumber}>
              <div className="eyebrow">Course {course.canonicalNumber}</div>
              <h2>{course.title}</h2>

              {offerings.length ? (
                <div className="classics-card-offerings" aria-label={`Course ${course.canonicalNumber} offerings`}>
                  {offerings.map((offering) => (
                    <Link href={offeringHref(course, offering)} key={offering.slug}>{offering.label} →</Link>
                  ))}
                </div>
              ) : schedule.length ? (
                <div className="classics-card-upcoming">
                  <Link href={`/courses/${course.slug}`}>{upcomingLabel(schedule)} →</Link>
                </div>
              ) : (
                <div className="classics-card-upcoming meta">Course Offering to be added</div>
              )}
            </article>
          )
        })}
      </section>
    </main>
  )
}
