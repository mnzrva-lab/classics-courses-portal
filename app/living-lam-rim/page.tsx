import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
        .select('id, slug, label, title, kind, starts_on, ends_on, sort_order')
        .eq('course_id', course.id)
        .eq('status', 'published')
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
    <main className="container page">
      <div className="eyebrow">Ongoing program</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>Living Lam Rim</h1>
      <p className="lead">Browse by term, then open the individual class you want to study.</p>

      {(groups ?? []).length ? (
        <section className="section grid two">
          {(groups ?? []).map((group: any) => {
            const count = sessionCount.get(group.id) ?? 0
            const dateRange = group.starts_on || group.ends_on
              ? [group.starts_on, group.ends_on].filter(Boolean).join(' to ')
              : null
            return (
              <Link className="card" key={group.id} href={`/living-lam-rim/${group.slug}`}>
                <div className="eyebrow">{group.label || 'Term'}</div>
                <h2 style={{ fontSize: 30, marginTop: 10 }}>{group.title || group.label}</h2>
                {dateRange ? <p className="meta">{dateRange}</p> : null}
                <div className="actions"><span className="pill">{count} published class{count === 1 ? '' : 'es'}</span></div>
              </Link>
            )
          })}
        </section>
      ) : (
        <section className="section card">
          <h2>Living Lam Rim terms are being organized for the library.</h2>
          <p className="meta">The production structure is ready for Term → Class navigation. Published terms will appear here automatically.</p>
        </section>
      )}
    </main>
  )
}
