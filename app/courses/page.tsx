import Link from 'next/link'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'

type CatalogCourse = {
  canonicalNumber: number
  slug: string
  title: string
}

type ArchiveOffering = { slug: string }
type ArchiveCourse = {
  canonicalNumber: number
  offerings?: ArchiveOffering[]
  schedule?: Array<{ label: string; date: string }>
}
type ArchiveCatalog = { courses: ArchiveCourse[] }

const catalog = rawCatalog as CatalogCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog
const archiveByNumber = new Map(archiveCatalog.courses.map((course) => [course.canonicalNumber, course]))

function courseMeta(course: CatalogCourse) {
  const archive = archiveByNumber.get(course.canonicalNumber)
  const offerings = archive?.offerings ?? []
  if (offerings.length === 1) return '1 Course Offering'
  if (offerings.length > 1) return `${offerings.length} Course Offerings`
  if (archive?.schedule?.length) return 'Upcoming'
  return ''
}

export default function CoursesPage() {
  return (
    <main className="container page classics-library-page">
      <div className="eyebrow">Classics library</div>
      <h1>The 18 Classics Courses</h1>
      <p className="lead">Choose a course to see its available Course Offerings, recordings, transcripts, and materials.</p>

      <section className="section compact-course-list" aria-label="The 18 Classics Courses">
        {catalog.map((course) => (
          <Link className="compact-course-link" href={`/courses/${course.slug}`} key={course.canonicalNumber}>
            <span className="compact-course-number">C{course.canonicalNumber}</span>
            <span className="compact-course-copy"><strong>{course.title}</strong></span>
            {courseMeta(course) ? <span className="compact-course-meta">{courseMeta(course)}</span> : null}
            <span className="compact-row-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </section>
    </main>
  )
}
