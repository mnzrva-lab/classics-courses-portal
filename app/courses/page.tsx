import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
    <main className="container page">
      <div className="eyebrow">Classics library</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>The 18 Classics Courses</h1>
      <p className="lead">Each canonical course may have more than one Course Offering. Choose the teaching you want to study.</p>

      <section className="grid two section">
        {(courses ?? []).map((course: any) => {
          const courseOfferings = (offerings ?? []).filter((offering: any) => offering.course_id === course.id)
          return (
            <article className="card" key={course.id}>
              <div className="pill">Course {course.canonical_number}</div>
              <h3 style={{ marginTop: 16 }}>{course.title}</h3>
              {courseOfferings.length > 0 ? (
                <div className="actions">
                  {courseOfferings.map((offering: any) => (
                    <Link className="button" key={offering.id} href={`/courses/${course.slug}/${offering.slug}`}>
                      {offering.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="meta">Teaching archive will be added here.</p>
              )}
            </article>
          )
        })}
      </section>
    </main>
  )
}
