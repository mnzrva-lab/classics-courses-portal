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

function contains(value: unknown, query: string) {
  return String(value ?? '').toLowerCase().includes(query)
}

export default async function MeditationsPage({
  searchParams,
}: {
  searchParams: Promise<{ duration?: string; topic?: string; teacher?: string; source?: string; q?: string }>
}) {
  const { duration, topic, teacher, source, q } = await searchParams
  const query = (q ?? '').trim().toLowerCase()
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
  const allTeachers = Array.from(new Set((instances as any[]).map((item) => item.teachers?.full_name).filter(Boolean))).sort()
  const allSources = Array.from(new Set((instances as any[]).map((item) => item.sessions?.courses?.title).filter(Boolean))).sort()
  const hasVersionFilters = Boolean((duration && duration !== 'all') || teacher || source)

  const filtered = meditations.filter((meditation: any) => {
    const meditationInstances = instancesByMeditation.get(meditation.id) ?? []
    const topicMatches = !topic || topic === 'all' || (meditation.topics ?? []).includes(topic)
    const queryMatches = !query || [
      meditation.name,
      meditation.description,
      ...(meditation.topics ?? []),
      ...meditationInstances.flatMap((instance) => [
        instance.title,
        instance.teachers?.full_name,
        instance.sessions?.title,
        instance.sessions?.courses?.title,
        instance.sessions?.course_offerings?.label,
      ]),
    ].some((value) => contains(value, query))

    const versionMatches = !hasVersionFilters || meditationInstances.some((instance) => {
      const durationMatches = !duration || duration === 'all' || durationGroup(instance.duration_seconds) === duration
      const teacherMatches = !teacher || instance.teachers?.full_name === teacher
      const sourceMatches = !source || instance.sessions?.courses?.title === source
      return durationMatches && teacherMatches && sourceMatches
    })

    return topicMatches && queryMatches && versionMatches
  })

  return (
    <main className="container page">
      <div className="eyebrow">Practice library</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>Meditations</h1>
      <p className="lead">Canonical meditation practices with versions from different courses and programs.</p>

      <section className="section card">
        <div className="eyebrow">Find a practice</div>
        <form className="form-stack" method="get" action="/meditations">
          <label>Search
            <input className="input" type="search" name="q" defaultValue={q ?? ''} placeholder="Topic, practice name, teacher, or source course…" />
          </label>
          <div className="grid two">
            <label>Duration
              <select className="input" name="duration" defaultValue={duration ?? 'all'}>
                <option value="all">Any duration</option>
                <option value="quick">Quick · up to 15 min</option>
                <option value="medium">Medium · 16–29 min</option>
                <option value="full">Full · 30–60+ min</option>
              </select>
            </label>
            <label>Topic
              <select className="input" name="topic" defaultValue={topic ?? 'all'}>
                <option value="all">Any topic</option>
                {allTopics.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>Teacher
              <select className="input" name="teacher" defaultValue={teacher ?? ''}>
                <option value="">Any teacher</option>
                {allTeachers.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>Source course or program
              <select className="input" name="source" defaultValue={source ?? ''}>
                <option value="">Any source</option>
                {allSources.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="actions">
            <button className="button red" type="submit">Apply filters</button>
            {(q || duration || topic || teacher || source) ? <Link className="button" href="/meditations">Clear filters</Link> : null}
          </div>
        </form>
      </section>

      <section className="section">
        {filtered.length ? (
          <div className="grid two">
            {filtered.map((meditation: any) => {
              const meditationInstances = instancesByMeditation.get(meditation.id) ?? []
              const durationText = meditationInstances.length
                ? durationLabel(meditationInstances.find((instance) => instance.duration_seconds)?.duration_seconds ?? null)
                : 'Versions coming soon'
              const teacherNames = Array.from(new Set(meditationInstances.map((instance) => instance.teachers?.full_name).filter(Boolean)))
              return (
                <Link className="card" key={meditation.id} href={`/meditations/${meditation.slug}`}>
                  <div className="eyebrow">Meditation</div>
                  <h2 style={{ fontSize: 30 }}>{meditation.name}</h2>
                  {meditation.description ? <p>{meditation.description}</p> : null}
                  <div className="meta">{durationText} · {meditationInstances.length} version{meditationInstances.length === 1 ? '' : 's'}</div>
                  {teacherNames.length ? <div className="meta" style={{ marginTop: 6 }}>{teacherNames.join(', ')}</div> : null}
                  {(meditation.topics ?? []).length ? <div className="actions" style={{ marginTop: 14 }}>{meditation.topics.map((item: string) => <span className="pill" key={item}>{item}</span>)}</div> : null}
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="card">
            <h2>{meditations.length ? 'No meditations match these filters.' : 'Meditations will appear here as they are published.'}</h2>
            <p className="meta">The library supports canonical meditation names, duration, teacher, topic, audio, source-course links, Study Notes, and source transcripts.</p>
          </div>
        )}
      </section>
    </main>
  )
}
