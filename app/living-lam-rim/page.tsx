import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function formatRange(start: string | null, end: string | null) {
  if (!start && !end) return null
  const date = (value: string) => new Date(`${value}T12:00:00Z`)
  const full = (value: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date(value))
  if (!start) return full(end!)
  if (!end || start === end) return full(start)
  const s = date(start)
  const e = date(end)
  if (s.getUTCFullYear() === e.getUTCFullYear()) {
    const startLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(s)
    const endLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(e)
    return `${startLabel} – ${endLabel}`
  }
  return `${full(start)} – ${full(end)}`
}

function termCode(slug: string) {
  const match = slug.match(/term-(\d+)/i)
  return match ? `T${match[1]}` : 'Term'
}

export default async function LivingLamRimPage() {
  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title, subtitle, description')
    .eq('kind', 'living_lam_rim')
    .eq('status', 'published')
    .maybeSingle()

  const { data: offerings } = course
    ? await supabase
        .from('course_offerings')
        .select('id, slug, label, starts_on, ends_on, sort_order')
        .eq('course_id', course.id)
        .eq('status', 'published')
        .order('sort_order')
    : { data: [] as any[] }

  const offeringIds = (offerings ?? []).map((offering: any) => offering.id)
  const { data: sessions } = offeringIds.length
    ? await supabase
        .from('sessions')
        .select('id, offering_id')
        .in('offering_id', offeringIds)
        .eq('status', 'published')
    : { data: [] as any[] }

  const sessionCount = new Map<string, number>()
  for (const session of sessions ?? []) {
    if (!session.offering_id) continue
    sessionCount.set(session.offering_id, (sessionCount.get(session.offering_id) ?? 0) + 1)
  }

  return (
    <main className="container page living-lam-rim-page">
      <div className="eyebrow">Ongoing program</div>
      <h1>Living Lam Rim</h1>
      <p className="lead">Six terms of teaching with Timothy Lowenhaupt. Open a term to study only the classes from that period.</p>

      <section className="section living-terms-section">
        <div className="living-terms-head">
          <div>
            <h2>Terms</h2>
            <p>Choose a term to open its classes and teaching archive.</p>
          </div>
        </div>

        {(offerings ?? []).length ? (
          <div className="living-term-grid">
            {(offerings ?? []).map((offering: any) => {
              const count = sessionCount.get(offering.id) ?? 0
              return (
                <Link className="living-term-card" key={offering.id} href={`/living-lam-rim/${offering.slug}`}>
                  <span className="living-term-code">{termCode(offering.slug)}</span>
                  <span className="living-term-copy">
                    <strong>{offering.label}</strong>
                    <span>{formatRange(offering.starts_on, offering.ends_on)}</span>
                    <small>{count} session{count === 1 ? '' : 's'}</small>
                  </span>
                  <span className="living-term-arrow" aria-hidden="true">→</span>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="card">
            <h2>Living Lam Rim terms are being organized for the library.</h2>
            <p className="meta">Published terms will appear here automatically.</p>
          </div>
        )}
      </section>
    </main>
  )
}
