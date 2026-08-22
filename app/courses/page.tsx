import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function offeringLabel(offering: { label: string; location: string | null; year: number | null }) {
  if (offering.location && offering.year) return `${offering.location} ${offering.year}`
  return offering.label
}

export default async function CoursesPage() {
  const supabase = await createClient()
  const { data: courses } = await supabase
    .from('courses')
    .select('id, slug, canonical_number, title, subtitle')
    .eq('kind', 'classics')
    .eq('status', 'published')
    .order('canonical_number', { ascending: true })

  const { data: offerings } = await supabase
    .from('course_offerings')
    .select('id, course_id, slug, label, location, year')
    .eq('status', 'published')
    .order('year', { ascending: false })

  return (
    <main className="container page classics-library-page">
      <div className="eyebrow">Classics library</div>
      <h1>The 18 Classics Courses</h1>
      <p className="lead">Choose a course, then open the teaching offering you want to study.</p>

      <section className="classics-library-grid section">
        {(courses ?? []).map((course: any) => {
          const courseOfferings = (offerings ?? []).filter((offering: any) => offering.course_id === course.id)
          return (
            <article className="classics-course-card" key={course.id}>
              <div className="eyebrow classics-course-eyebrow">Course {course.canonical_number}</div>
              <h2>{course.title}</h2>
              {course.subtitle ? <p>{course.subtitle}</p> : null}
              {courseOfferings.length > 0 ? (
                <div className="classics-offering-line">
                  {courseOfferings.map((offering: any, index: number) => (
                    <span key={offering.id}>
                      {index > 0 ? <span className="classics-offering-separator"> · </span> : null}
                      <Link href={`/courses/${course.slug}/${offering.slug}`}>{offeringLabel(offering)}</Link>
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
