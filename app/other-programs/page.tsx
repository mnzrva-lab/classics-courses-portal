import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function OtherProgramsPage() {
  const supabase = await createClient()
  const { data: courses } = await supabase
    .from('courses')
    .select('id, slug, title, subtitle, description, kind, course_offerings(slug, label, status, sort_order)')
    .eq('status', 'published')
    .not('kind', 'in', '(classics,living_lam_rim)')
    .order('sort_order')

  return (
    <main className="container page">
      <div className="eyebrow">Other Programs</div>
      <h1>Other teachings and study projects</h1>
      <p className="lead">Long-form programs and study projects that sit outside the 18 Classics Courses and Living Lam Rim.</p>

      <section className="section grid two">
        {(courses ?? []).length ? (courses ?? []).map((course: any) => {
          const offerings = (course.course_offerings ?? [])
            .filter((offering: any) => offering.status === 'published')
            .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          const offering = offerings[0]
          const href = offering ? `/courses/${course.slug}/${offering.slug}` : null

          return (
            <div className="card" key={course.id}>
              <div className="eyebrow">{course.kind === 'book' ? 'Text study' : 'Program'}</div>
              <h2 style={{ fontSize: 30 }}>{course.title}</h2>
              {course.subtitle ? <p>{course.subtitle}</p> : null}
              {course.description ? <p className="meta">{course.description}</p> : null}
              <div className="actions">
                {href ? <Link className="button sage" href={href}>Open program</Link> : <span className="pill">Content being organized</span>}
              </div>
            </div>
          )
        }) : (
          <div className="card"><p className="meta">No additional programs have been published yet.</p></div>
        )}
      </section>
    </main>
  )
}
