import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SessionTime from '@/components/session-time'

export const dynamic = 'force-dynamic'

type OfferingRelation = { slug: string; label: string; status: string }
type TeacherLink = { teachers: { full_name: string } | null }

export default async function LivingLamRimTermPage({ params }: { params: Promise<{ termSlug: string }> }) {
  const { termSlug } = await params
  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title')
    .eq('kind', 'living_lam_rim')
    .eq('status', 'published')
    .maybeSingle()
  if (!course) notFound()

  const { data: group } = await supabase
    .from('content_groups')
    .select('id, slug, label, title, kind, starts_on, ends_on')
    .eq('course_id', course.id)
    .eq('slug', termSlug)
    .eq('status', 'published')
    .maybeSingle()
  if (!group) notFound()

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, slug, code, title, session_type, session_date, starts_at, source_timezone,
      course_offerings!inner(slug, label, status),
      session_teachers(teachers(full_name))
    `)
    .eq('group_id', group.id)
    .eq('status', 'published')
    .eq('course_offerings.status', 'published')
    .order('sort_order')

  const dateRange = group.starts_on || group.ends_on
    ? [group.starts_on, group.ends_on].filter(Boolean).join(' to ')
    : null

  return (
    <main className="container page">
      <div className="actions" style={{ marginTop: 0, marginBottom: 22 }}>
        <Link className="button" href="/living-lam-rim">← Living Lam Rim</Link>
      </div>

      <div className="eyebrow">{group.label}</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>{group.title || group.label}</h1>
      {dateRange ? <p className="lead" style={{ fontSize: 18 }}>{dateRange}</p> : null}

      <section className="section card">
        <div className="eyebrow">Classes</div>
        <h2 style={{ fontSize: 32 }}>Study this term</h2>
        {(sessions ?? []).length ? (
          <div className="list">
            {(sessions ?? []).map((session: any) => {
              const offering = session.course_offerings as OfferingRelation
              const teachers = ((session.session_teachers ?? []) as TeacherLink[])
                .map((item) => item.teachers?.full_name)
                .filter(Boolean)
              const href = `/courses/${course.slug}/${offering.slug}/${session.slug}`

              return (
                <div className="row" key={session.id}>
                  <div className="session-code">{session.code || '•'}</div>
                  <div>
                    <Link href={href}><strong>{session.title}</strong></Link>
                    <div className="meta">
                      {teachers.length ? `${teachers.join(', ')} · ` : ''}
                      {session.starts_at ? <SessionTime startsAt={session.starts_at} sourceTimezone={session.source_timezone} /> : session.session_date ?? 'Date not added'}
                    </div>
                  </div>
                  <Link className="button" href={href}>Open class</Link>
                </div>
              )
            })}
          </div>
        ) : <p className="meta">No published classes are available in this term yet.</p>}
      </section>
    </main>
  )
}
