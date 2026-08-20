import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function durationLabel(seconds: number | null) {
  if (!seconds) return 'Duration not added'
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes <= 15) return `Quick · ${minutes} min`
  if (minutes <= 29) return `Medium · ${minutes} min`
  return `Full · ${minutes} min`
}

function durationGroup(seconds: number | null) {
  if (!seconds) return 'unknown'
  const minutes = seconds / 60
  if (minutes <= 15) return 'quick'
  if (minutes <= 29) return 'medium'
  return 'full'
}

export default async function MeditationsPage({
  searchParams,
}: {
  searchParams: Promise<{ duration?: string; topic?: string }>
}) {
  const { duration, topic } = await searchParams
  const supabase = await createClient()

  const [{ data: meditationRows }, { data: instanceRows }] = await Promise.all([
    supabase
      .from('meditations')
      .select('id, slug, name, description, topics')
      .eq('status', 'published')
      .order('name'),
    supabase
      .from('meditation_instances')
      .select(`
        id, meditation_id, title, duration_seconds, audio_url,
        teachers(full_name),
        sessions(slug, title, audio_url, recording_url, courses(slug, title), course_offerings(slug, label))
      `)
      .eq('status', 'published'),
  ])

  const meditations = meditationRows ?? []
  const instances = instanceRows ?? []
  const instancesByMeditation = new Map<string, any[]>()
  for (const instance of instances as any[]) {
    const list = instancesByMeditation.get(instance.meditation_id) ?? []
    list.push(instance)
    instancesByMeditation.set(instance.meditation_id, list)
  }

  const allTopics = Array.from(new Set(meditations.flatMap((item: any) => item.topics ?? []))).sort()
  const filtered = meditations.filter((meditation: any) => {
    const meditationInstances = instancesByMeditation.get(meditation.id) ?? []
    const durationMatches = !duration || duration === 'all' || meditationInstances.some((instance) => durationGroup(instance.duration_seconds) === duration)
    const topicMatches = !topic || topic === 'all' || (meditation.topics ?? []).includes(topic)
    return durationMatches && topicMatches
  })

  return (
    <main className="container page">
      <div className="eyebrow">Practice library</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>Meditations</h1>
      <p className="lead">Canonical meditation practices with versions from different courses and programs.</p>

      <section className="section card">
        <div className="eyebrow">Duration</div>
        <div className="actions">
          <Link className="button" href="/meditations">All</Link>
          <Link className="button" href="/meditations?duration=quick">Quick · up to 15 min</Link>
          <Link className="button" href="/meditations?duration=medium">Medium · 16–29 min</Link>
          <Link className="button" href="/meditations?duration=full">Full · 30–60+ min</Link>
        </div>
        {allTopics.length > 0 ? (
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow">Topics</div>
            <div className="actions">
              {allTopics.map((item) => (
                <Link className="button" key={item} href={`/meditations?topic=${encodeURIComponent(item)}`}>{item}</Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="section">
        {filtered.length ? (
          <div className="grid two">
            {filtered.map((meditation: any) => {
              const meditationInstances = instancesByMeditation.get(meditation.id) ?? []
              const durationText = meditationInstances.length
                ? durationLabel(meditationInstances.find((instance) => instance.duration_seconds)?.duration_seconds ?? null)
                : 'Versions coming soon'
              return (
                <Link className="card" key={meditation.id} href={`/meditations/${meditation.slug}`}>
                  <div className="eyebrow">Meditation</div>
                  <h2 style={{ fontSize: 30 }}>{meditation.name}</h2>
                  {meditation.description ? <p>{meditation.description}</p> : null}
                  <div className="meta">{durationText} · {meditationInstances.length} version{meditationInstances.length === 1 ? '' : 's'}</div>
                  {(meditation.topics ?? []).length ? <div className="actions" style={{ marginTop: 14 }}>{meditation.topics.map((item: string) => <span className="pill" key={item}>{item}</span>)}</div> : null}
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="card">
            <h2>Meditations will appear here as they are published.</h2>
            <p className="meta">The library is ready for canonical meditation names, duration, teacher, topic, audio, and source-course links.</p>
          </div>
        )}
      </section>
    </main>
  )
}
