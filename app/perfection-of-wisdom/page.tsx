import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const lineage = [
  {
    label: 'Source',
    title: 'The Buddha’s Perfection of Wisdom teachings',
    text: 'The scriptural source from which the commentarial tradition develops.',
  },
  {
    label: 'Root text · c. 350 AD',
    title: 'Jewel of Realizations',
    text: 'Abhisamaya Alankara, spoken by Lord Maitreya and written down by Arya Asanga.',
  },
  {
    label: 'Commentary · c. 750 AD',
    title: 'Master Haribhadra',
    text: 'A classical commentary frequently referenced by the monastic textbooks.',
  },
  {
    label: 'Dialectic analysis',
    title: 'Kedrup Tenpa Dargye',
    text: '1493–1568. String of White Lotuses, PAD MA DKAR PO’I PHRENG BA.',
  },
  {
    label: 'Current translation',
    title: 'Timothy Lowenhaupt with Geshe Michael Roach',
    text: 'The translation and teaching work represented in this archive.',
  },
]

function formatDate(value: string | null | undefined) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function dateRange(start: string | null | undefined, end: string | null | undefined) {
  const first = formatDate(start)
  const last = formatDate(end)
  if (first && last && first !== last) return `${first} – ${last}`
  return first || last || 'Date not added'
}

export default async function PerfectionOfWisdomPage() {
  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title, subtitle, description')
    .eq('slug', 'perfection-of-wisdom')
    .eq('status', 'published')
    .maybeSingle()

  const { data: offering } = course
    ? await supabase
        .from('course_offerings')
        .select('id, slug, label, starts_on, ends_on, status, sort_order')
        .eq('course_id', course.id)
        .eq('status', 'published')
        .order('sort_order')
        .limit(1)
        .maybeSingle()
    : { data: null as any }

  let groups: any[] = []
  let sessions: any[] = []
  let materials: any[] = []

  if (offering) {
    const [groupResult, sessionResult, materialResult] = await Promise.all([
      supabase
        .from('content_groups')
        .select('id, slug, label, title, starts_on, ends_on, sort_order')
        .eq('offering_id', offering.id)
        .eq('status', 'published')
        .order('sort_order'),
      supabase
        .from('sessions')
        .select('id, slug, code, title, session_type, session_date, duration_seconds, group_id, sort_order, session_teachers(teachers(full_name))')
        .eq('offering_id', offering.id)
        .eq('status', 'published')
        .order('sort_order'),
      supabase
        .from('materials')
        .select('id, title, url, material_type, status')
        .eq('offering_id', offering.id)
        .is('session_id', null)
        .eq('status', 'published')
        .order('sort_order'),
    ])
    groups = groupResult.data ?? []
    sessions = sessionResult.data ?? []
    materials = materialResult.data ?? []
  }

  const sessionsByGroup = new Map<string, any[]>()
  for (const session of sessions) {
    if (!session.group_id) continue
    const current = sessionsByGroup.get(session.group_id) ?? []
    current.push(session)
    sessionsByGroup.set(session.group_id, current)
  }

  const playlist = materials.find((material) => material.material_type === 'video' && material.url?.includes('list='))
  const recordingCount = sessions.length || 58

  return (
    <main className="container page">
      <section className="program-hero">
        <div className="eyebrow">Diamond Cutter Classics · Book 1</div>
        <h1>{course?.title ?? 'A Dialectic Analysis of the Perfection of Wisdom'}</h1>
        <p className="program-subtitle"><i>String of White Lotuses</i> (PAD MA DKAR PO’I PHRENG BA) · a dialectical analysis (MTHA’ DPYOD) of the Perfection of Wisdom.</p>
        <p className="program-intro">Root text by Lord Maitreya with Arya Asanga (c. 350 AD), commentary by Kedrup Tenpa Dargye (1493–1568), translated by Timothy Lowenhaupt with Geshe Michael Roach.</p>
        <div className="program-facts">
          <div className="program-fact"><strong>8</strong><span>major realizations</span></div>
          <div className="program-fact"><strong>70</strong><span>topics on the path</span></div>
          <div className="program-fact"><strong>{recordingCount}</strong><span>recordings in this archive</span></div>
        </div>
      </section>

      <details className="program-disclosure">
        <summary><span>Commentary lineage &amp; context</span></summary>
        <div className="program-disclosure-body">
          <div className="program-lineage">
            {lineage.map((step, index) => (
              <div className="program-lineage-step" key={step.title}>
                <div className="program-lineage-index">{index + 1}</div>
                <small>{step.label}</small>
                <strong>{step.title}</strong>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
          <div className="program-context">
            <p><strong>Each major topic of the traditional geshe course typically has two commentaries</strong> studied at major monasteries in the tradition of Je Tsongkapa: an “overview” and a “dialectic analysis”, or analysis in debate format.</p>
            <p>For the study of the lower Middle Way, the Independent group of the Middle Way School, these are typically referred to as “commentaries on the perfection of wisdom” (<i>prajna paramita</i>), although that is only a nickname and the literature covers much more than this subschool.</p>
            <p>Monastic textbooks on the perfection of wisdom consist of detailed commentaries on the profound Buddhist topics found in the <i>Jewel of Realizations (Abhisamaya Alankara)</i>, spoken by the future Buddha Maitreya and written down by Arya Asanga in about 350 AD.</p>
            <p>They typically quote the root text at the opening of each topic and may also refer to the corresponding section in a commentary by Master Haribhadra, c. 750 AD.</p>
          </div>
        </div>
      </details>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Teaching archive</div>
            <h2>Chronological timeline</h2>
            <p>One continuous course archive, grouped by teaching season and ordered by the teaching dates preserved in V12.</p>
          </div>
          {playlist?.url ? <a className="button" href={playlist.url} target="_blank" rel="noreferrer">▶ Full playlist ↗</a> : null}
        </div>

        {offering && groups.length ? (
          <div className="program-timeline">
            {groups.map((group) => {
              const seasonSessions = sessionsByGroup.get(group.id) ?? []
              return (
                <details className="program-season" key={group.id}>
                  <summary>
                    <div className="program-season-title">
                      <strong>{group.label}</strong>
                      <span>{dateRange(group.starts_on, group.ends_on)}</span>
                    </div>
                    <span className="program-season-count">{seasonSessions.length} recording{seasonSessions.length === 1 ? '' : 's'}</span>
                  </summary>
                  <div className="program-season-sessions">
                    {seasonSessions.map((session) => {
                      const teachers = (session.session_teachers ?? [])
                        .map((item: any) => item.teachers?.full_name)
                        .filter(Boolean)
                      return (
                        <div className="program-session-row" key={session.id}>
                          <div className="program-session-code">{session.code || '•'}</div>
                          <div className="program-session-copy">
                            <strong>{session.title}</strong>
                            <div className="meta">{formatDate(session.session_date) ?? 'Date not added'}{teachers.length ? ` · ${teachers.join(', ')}` : ''}</div>
                          </div>
                          <Link className="button" href={`/courses/${course?.slug ?? 'perfection-of-wisdom'}/${offering.slug}/${session.slug}`}>Open</Link>
                        </div>
                      )
                    })}
                  </div>
                </details>
              )
            })}
          </div>
        ) : (
          <div className="card cream program-archive-empty">
            <strong>The chronological teaching archive is being reviewed.</strong>
            <p className="meta" style={{ marginTop: 5 }}>The course information and lineage are available here now. The complete class timeline will appear when the reviewed archive is published.</p>
          </div>
        )}
        <p className="program-archive-note">Only recordings present in the supplied archive are shown, so some later class numbers have gaps.</p>
      </section>
    </main>
  )
}
