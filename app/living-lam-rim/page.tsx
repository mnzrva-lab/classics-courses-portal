import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function dateOnly(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function termDateRange(startsOn: string | null, endsOn: string | null) {
  const start = dateOnly(startsOn)
  const end = dateOnly(endsOn)
  if (!start && !end) return null
  if (!start) return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(end!)
  if (!end) return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(start)

  const startMonthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(start)
  const endMonthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(end)
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()

  if (sameYear) return `${startMonthDay} – ${endMonthDay}, ${end.getUTCFullYear()}`
  return `${startMonthDay}, ${start.getUTCFullYear()} – ${endMonthDay}, ${end.getUTCFullYear()}`
}

function termBadge(label: string | null, sortOrder: number) {
  const match = label?.match(/(\d+)/)
  return `T${match?.[1] ?? Math.max(1, Math.round(sortOrder / 10))}`
}

export default async function LivingLamRimPage() {
  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title, subtitle, description')
    .eq('kind', 'living_lam_rim')
    .eq('status', 'published')
    .maybeSingle()

  const { data: groups } = course
    ? await supabase
        .from('content_groups')
        .select('id, slug, label, title, kind, starts_on, ends_on, sort_order, course_offerings!inner(status)')
        .eq('course_id', course.id)
        .eq('status', 'published')
        .eq('course_offerings.status', 'published')
        .order('sort_order')
    : { data: [] as any[] }

  const groupIds = (groups ?? []).map((group: any) => group.id)
  const { data: sessions } = groupIds.length
    ? await supabase
        .from('sessions')
        .select('id, group_id, status')
        .in('group_id', groupIds)
        .eq('status', 'published')
    : { data: [] as any[] }

  const sessionCount = new Map<string, number>()
  for (const session of sessions ?? []) {
    if (!session.group_id) continue
    sessionCount.set(session.group_id, (sessionCount.get(session.group_id) ?? 0) + 1)
  }

  return (
    <main className="container page living-lam-rim-page">
      <div className="eyebrow">Ongoing program</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>Living Lam Rim</h1>
      <p className="lead">Browse the teaching archive term by term.</p>

      {(groups ?? []).length ? (
        <section className="section living-terms-section">
          <div className="living-terms-heading">
            <h2>Terms</h2>
            <p>Choose a term to open its classes and teaching archive.</p>
          </div>

          <div className="living-term-grid">
            {(groups ?? []).map((group: any) => {
              const count = sessionCount.get(group.id) ?? 0
              const dateRange = termDateRange(group.starts_on, group.ends_on)
              const badge = termBadge(group.label, group.sort_order)
              return (
                <Link className="living-term-card" key={group.id} href={`/living-lam-rim/${group.slug}`}>
                  <div className="living-term-badge" aria-hidden="true">{badge}</div>
                  <div className="living-term-copy">
                    <h3>{group.title || group.label}</h3>
                    {dateRange ? <p className="living-term-dates">{dateRange}</p> : null}
                    <p className="living-term-count">{count} session{count === 1 ? '' : 's'}</p>
                  </div>
                  <span className="living-term-arrow" aria-hidden="true">→</span>
                </Link>
              )
            })}
          </div>
        </section>
      ) : (
        <section className="section card">
          <h2>Living Lam Rim terms are being organized for the library.</h2>
          <p className="meta">Published terms and classes will appear here automatically.</p>
        </section>
      )}
    </main>
  )
}
