import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SessionTime from '@/components/session-time'

export const dynamic = 'force-dynamic'

type OfferingRelation = { slug: string; label: string; status: string }
type TeacherLink = { teachers: { full_name: string } | null }

function dateOnly(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateLabel(value: string | null) {
  const date = dateOnly(value)
  if (!date) return null
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function dateRange(startsOn: string | null, endsOn: string | null) {
  const start = dateOnly(startsOn)
  const end = dateOnly(endsOn)
  if (!start && !end) return null
  if (!start) return dateLabel(endsOn)
  if (!end) return dateLabel(startsOn)
  const startMonthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(start)
  const endMonthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(end)
  if (start.getUTCFullYear() === end.getUTCFullYear()) return `${startMonthDay} – ${endMonthDay}, ${end.getUTCFullYear()}`
  return `${startMonthDay}, ${start.getUTCFullYear()} – ${endMonthDay}, ${end.getUTCFullYear()}`
}

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
    .select('id, slug, label, title, kind, starts_on, ends_on, course_offerings!inner(status)')
    .eq('course_id', course.id)
    .eq('slug', termSlug)
    .eq('status', 'published')
    .eq('course_offerings.status', 'published')
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

  const range = dateRange(group.starts_on, group.ends_on)

  return (
    <main className="container page living-lam-rim-term-page">
      <div className="actions" style={{ marginTop: 0, marginBottom: 22 }}>
        <Link className="button" href="/living-lam-rim">← Living Lam Rim</Link>
      </div>

      <div className="eyebrow">{group.label}</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>{group.title || group.label}</h1>
      {range ? <p className="lead" style={{ fontSize: 18 }}>{range}</p> : null}

      <section className="section card living-term-classes">
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
                <div className="row living-term-class-row" key={session.id}>
                  <div className="session-code">{session.code || '•'}</div>
                  <div>
                    <Link href={href}><strong>{session.title}</strong></Link>
                    <div className="meta">
                      {teachers.length ? `${teachers.join(', ')} · ` : ''}
                      {session.starts_at ? <SessionTime startsAt={session.starts_at} sourceTimezone={session.source_timezone} /> : dateLabel(session.session_date) ?? 'Date not added'}
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
