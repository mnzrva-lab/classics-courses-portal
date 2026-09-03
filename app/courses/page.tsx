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
}

type ArchiveCourse = {
  canonicalNumber: number
  offerings?: ArchiveOffering[]
  status?: string
  schedule?: Array<{ label: string; date: string }>
}

type ArchiveCatalog = {
  courses: ArchiveCourse[]
}

const catalog = rawCatalog as CatalogCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog
const archiveByNumber = new Map(archiveCatalog.courses.map((course) => [course.canonicalNumber, course]))

function availability(course: CatalogCourse) {
  const archive = archiveByNumber.get(course.canonicalNumber)
  const offerings = archive?.offerings ?? []
  if (offerings.length === 1) return '1 teaching archive available'
  if (offerings.length > 1) return `${offerings.length} teaching archives available`
  if (archive?.schedule?.length) return 'Scheduled Sep 2026 – Jan 2027'
  return 'Teaching archive to be added'
}

export default function CoursesPage() {
  return (
    <main className="container page classics-library-page">
      <div className="eyebrow">Classics library</div>
      <h1>The 18 Classics Courses</h1>
      <p className="lead">Choose a course, then open the Course Offering or teaching archive you want to study.</p>

      <section className="classics-library-grid section">
        {catalog.map((course) => {
          const available = Boolean(archiveByNumber.get(course.canonicalNumber)?.offerings?.length)
          return (
            <article className="classics-course-card" key={course.canonicalNumber}>
              <div className="eyebrow classics-course-eyebrow">Course {course.canonicalNumber}</div>
              <h2>{course.title}</h2>
              <div className={available ? 'classics-offering-line' : 'classics-offering-empty'}>{availability(course)}</div>
              <div className="actions" style={{ marginTop: 14 }}><Link className={course.canonicalNumber === 8 ? 'button sage' : 'button'} href={`/courses/${course.slug}`}>Open course</Link></div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
