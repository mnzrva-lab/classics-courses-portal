import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function durationLabel(seconds: number | null) {
  if (!seconds) return 'Duration not added'
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes <= 15) return `Quick · ${minutes} min`
  if (minutes <= 30) return `Medium · ${minutes} min`
  return `Full · ${minutes} min`
}

function durationGroup(seconds: number | null) {
  if (!seconds) return 'unknown'
  const minutes = seconds / 60
  if (minutes <= 15) return 'quick'
  if (minutes <= 30) return 'medium'
  return 'full'
}

function contains(value: unknown, query: string) {
  return String(value ?? '').toLowerCase().includes(query)
}

function buildHref(values: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value)
  const qs = params.toString()
  return qs ? `/meditations?${qs}` : '/meditations'
}

export default async function MeditationsPage({
  searchParams,
}: {
  searchParams: Promise<{ duration?: string; topic?: string; teacher?: string; source?: string; q?: string }>
}) {
  const { duration = 'all', topic, teacher, source, q } = await searchParams
  const query = (q ?? '').trim().toLowerCase()
  const supabase = await createClient()

  const [{ data: meditationRows }, { data: instanceRows }] = await Promise.all([
    supabase.from('meditations').select('id, slug, name, description, topics').eq('status', 'published').order('name'),
    supabase.from('meditation_instances').select(`id, meditation_id, title, duration_seconds, audio_url, teachers(full_name), sessions(slug, title, audio_url, recording_url, courses(slug, title), course_offerings(slug, label))`).eq('status', 'published'),
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
  const visibleTopics = allTopics.slice(0, 8)
  const hasAdvancedFilters = Boolean(topic || teacher || source || q)

  const filtered = meditations.filter((meditation: any) => {
    const meditationInstances = instancesByMeditation.get(meditation.id) ?? []
    const topicMatches = !topic || (meditation.topics ?? []).includes(topic)
    const queryMatches = !query || [meditation.name, meditation.description, ...(meditation.topics ?? []), ...meditationInstances.flatMap((instance) => [instance.title, instance.teachers?.full_name, instance.sessions?.title, instance.sessions?.courses?.title, instance.sessions?.course_offerings?.label])].some((value) => contains(value, query))
    const versionMatches = meditationInstances.some((instance) => {
      const durationMatches = duration === 'all' || durationGroup(instance.duration_seconds) === duration
      const teacherMatches = !teacher || instance.teachers?.full_name === teacher
      const sourceMatches = !source || instance.sessions?.courses?.title === source
      return durationMatches && teacherMatches && sourceMatches
    }) || (!meditationInstances.length && duration === 'all' && !teacher && !source)
    return topicMatches && queryMatches && versionMatches
  })

  const durationFilters = [
    ['all', 'All'],
    ['quick', 'Up to 15 min'],
    ['medium', '16–30 min'],
    ['full', '30+ min'],
  ]

  return (
    <main className="container page meditation-library-simple">
      <div className="eyebrow">Practice library</div>
      <h1>Meditations</h1>
      <p className="lead">Choose by time first. Open advanced filters only when you need a specific teacher, source course, or topic.</p>

      <section className="section meditation-find-simple">
        <div className="eyebrow">How much time do you have?</div>
        <div className="duration-filter-row">
          {durationFilters.map(([value, label]) => (
            <Link className={duration === value ? 'duration-filter active' : 'duration-filter'} key={value} href={buildHref({ duration: value === 'all' ? undefined : value, topic, teacher, source, q })}>{label}</Link>
          ))}
        </div>

        {visibleTopics.length ? <div className="meditation-topic-shortlist"><strong>Browse by topic</strong><div>{visibleTopics.map((item) => <Link className={topic === item ? 'topic-link active' : 'topic-link'} key={item} href={buildHref({ duration: duration === 'all' ? undefined : duration, topic: topic === item ? undefined : item, teacher, source, q })}>{item}</Link>)}</div></div> : null}

        <details className="advanced-search meditation-advanced" open={hasAdvancedFilters}>
          <summary>Advanced filters</summary>
          <form className="advanced-search-form" method="get" action="/meditations">
            {duration !== 'all' ? <input type="hidden" name="duration" value={duration} /> : null}
            <label>Search<input type="search" name="q" defaultValue={q ?? ''} placeholder="Practice name or keyword…" /></label>
            <label>Topic<select name="topic" defaultValue={topic ?? ''}><option value="">Any topic</option>{allTopics.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Teacher<select name="teacher" defaultValue={teacher ?? ''}><option value="">Any teacher</option>{allTeachers.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Source course or program<select name="source" defaultValue={source ?? ''}><option value="">Any source</option>{allSources.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <div className="actions"><button className="button sage" type="submit">Apply filters</button>{hasAdvancedFilters ? <Link className="button" href={duration === 'all' ? '/meditations' : `/meditations?duration=${duration}`}>Clear advanced filters</Link> : null}</div>
          </form>
        </details>
      </section>

      <section className="section">
        {filtered.length ? <div className="grid two">{filtered.map((meditation: any) => {
          const meditationInstances = instancesByMeditation.get(meditation.id) ?? []
          const durationText = meditationInstances.length ? durationLabel(meditationInstances.find((instance) => instance.duration_seconds)?.duration_seconds ?? null) : 'Versions coming soon'
          const teacherNames = Array.from(new Set(meditationInstances.map((instance) => instance.teachers?.full_name).filter(Boolean)))
          return <Link className="card" key={meditation.id} href={`/meditations/${meditation.slug}`}>
            <div className="eyebrow">Meditation</div><h2 style={{ fontSize: 30 }}>{meditation.name}</h2>
            {meditation.description ? <p>{meditation.description}</p> : null}
            <div className="meta">{durationText} · {meditationInstances.length} version{meditationInstances.length === 1 ? '' : 's'}</div>
            {teacherNames.length ? <div className="meta" style={{ marginTop: 6 }}>{teacherNames.join(', ')}</div> : null}
            {(meditation.topics ?? []).length ? <div className="actions" style={{ marginTop: 14 }}>{meditation.topics.slice(0, 4).map((item: string) => <span className="pill" key={item}>{item}</span>)}</div> : null}
          </Link>
        })}</div> : <div className="card"><h2>{meditations.length ? 'No meditations match these filters.' : 'Meditations will appear here as they are published.'}</h2><p className="meta">Try another duration or clear the advanced filters.</p></div>}
      </section>
    </main>
  )
}
