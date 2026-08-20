import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function LivingLamRimPage() {
  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, title, subtitle, description')
    .eq('kind', 'living_lam_rim')
    .eq('status', 'published')
    .maybeSingle()

  const { data: groups } = course
    ? await supabase
        .from('content_groups')
        .select('id, slug, title, group_type, sort_order')
        .eq('course_id', course.id)
        .order('sort_order')
    : { data: [] as any[] }

  const groupIds = (groups ?? []).map((group: any) => group.id)
  const { data: sessions } = groupIds.length
    ? await supabase
        .from('sessions')
        .select('id, slug, code, title, group_id, status, course_offerings(slug, label)')
        .in('group_id', groupIds)
        .eq('status', 'published')
        .order('sort_order')
    : { data: [] as any[] }

  const sessionsByGroup = new Map<string, any[]>()
  for (const session of sessions ?? []) {
    const list = sessionsByGroup.get((session as any).group_id) ?? []
    list.push(session)
    sessionsByGroup.set((session as any).group_id, list)
  }

  return (
    <main className="container page">
      <div className="eyebrow">Ongoing program</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>Living Lam Rim</h1>
      <p className="lead">Browse by term, then open the individual class you want to study.</p>

      {(groups ?? []).length ? (
        <section className="section">
          {(groups ?? []).map((group: any) => {
            const groupSessions = sessionsByGroup.get(group.id) ?? []
            return (
              <div className="card" key={group.id} style={{ marginBottom: 20 }}>
                <div className="eyebrow">{group.group_type || 'Term'}</div>
                <h2>{group.title}</h2>
                {groupSessions.length ? (
                  <div className="list">
                    {groupSessions.map((session: any) => {
                      const offering = session.course_offerings
                      const href = offering?.slug && course
                        ? `/courses/living-lam-rim/${offering.slug}/${session.slug}`
                        : null
                      return (
                        <div className="row" key={session.id}>
                          <div className="session-code">{session.code || '•'}</div>
                          <div><strong>{session.title}</strong></div>
                          {href ? <Link className="button" href={href}>Open class</Link> : null}
                        </div>
                      )
                    })}
                  </div>
                ) : <p className="meta">Classes for this term have not been published yet.</p>}
              </div>
            )
          })}
        </section>
      ) : (
        <section className="section card">
          <h2>Living Lam Rim terms are being organized for the library.</h2>
          <p className="meta">The production structure is ready for term → class navigation. Published terms will appear here automatically.</p>
        </section>
      )}
    </main>
  )
}
