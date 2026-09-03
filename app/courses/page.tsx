import Link from 'next/link'
import rawCatalog from '@/content/classics/catalog.json'

type CatalogOffering = {
  slug: string
  label: string
  location?: string
  year?: number
}

type CatalogCourse = {
  canonicalNumber: number
  slug: string
  title: string
  offerings?: CatalogOffering[]
}

const catalog = rawCatalog as CatalogCourse[]

export default function CoursesPage() {
  return (
    <main className="container page classics-library-page">
      <div className="eyebrow">Classics library</div>
      <h1>The 18 Classics Courses</h1>
      <p className="lead">Choose a course, then open the teaching offering you want to study.</p>

      <section className="classics-library-grid section">
        {catalog.map((course) => {
          const offerings = course.offerings ?? []
          return (
            <article className="classics-course-card" key={course.canonicalNumber}>
              <div className="eyebrow classics-course-eyebrow">Course {course.canonicalNumber}</div>
              <h2>{course.title}</h2>
              {offerings.length > 0 ? (
                <div className="classics-offering-line">
                  {offerings.map((offering, index) => (
                    <span key={offering.slug}>
                      {index > 0 ? <span className="classics-offering-separator"> · </span> : null}
                      <Link href={`/courses/${course.slug}/${offering.slug}`}>{offering.label}</Link>
                    </span>
                  ))}
                </div>
              ) : (
                <span className="classics-offering-empty">Teaching archive to be added</span>
              )}
            </article>
          )
        })}
      </section>
    </main>
  )
}
