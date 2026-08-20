import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function formatDuration(seconds: number | null) {
  if (!seconds) return 'Duration not added'
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes <= 15) return `Quick · ${minutes} min`
  if (minutes <= 29) return `Medium · ${minutes} min`
  return `Full · ${minutes} min`
}

export default async function MeditationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: meditation } = await supabase
    .from('meditations')
    .select('id, slug, name, description, topics')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!meditation) notFound()

  const { data: instances } = await supabase
    .from('meditation_instances')
    .select(`
      id, title, start_seconds, end_seconds, duration_seconds, audio_url,
      teachers(full_name),
      sessions(slug, code, title, audio_url, recording_url, courses(slug, title), course_offerings(slug, label))
    `)
    .eq('meditation_id', meditation.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  return (
    <main className="container page">
      <div className="eyebrow">Meditation</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>{meditation.name}</h1>
      {meditation.description ? <p className="lead">{meditation.description}</p> : null}
      {(meditation.topics ?? []).length ? (
        <div className="actions">{meditation.topics.map((topic: string) => <span className="pill" key={topic}>{topic}</span>)}</div>
      ) : null}

      <section className="section">
        <div className="eyebrow">Versions</div>
        <h2>Practice from different teachings</h2>
        {(instances ?? []).length ? (
          <div className="grid two">
            {(instances ?? []).map((instance: any) => {
              const session = instance.sessions
              const course = session?.courses
              const offering = session?.course_offerings
              const teacher = instance.teachers?.full_name
              const sourceHref = course?.slug && offering?.slug && session?.slug
                ? `/courses/${course.slug}/${offering.slug}/${session.slug}`
                : null
              const audioUrl = instance.audio_url || session?.audio_url
              return (
                <div className="card" key={instance.id}>
                  <div className="eyebrow">{formatDuration(instance.duration_seconds)}</div>
                  <h3>{instance.title || session?.title || meditation.name}</h3>
                  <p className="meta">
                    {teacher ? `${teacher} · ` : ''}
                    {course?.title ?? 'Source teaching'}{offering?.label ? ` · ${offering.label}` : ''}
                  </p>
                  {audioUrl ? <audio controls src={audioUrl} style={{ width: '100%', marginTop: 14 }} /> : null}
                  <div className="actions">
                    {sourceHref ? <Link className="button" href={sourceHref}>Open source class</Link> : null}
                    {!audioUrl && session?.recording_url ? <a className="button" href={session.recording_url} target="_blank" rel="noreferrer">Open recording</a> : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card"><p className="meta">No published versions are available yet.</p></div>
        )}
      </section>

      <section className="section"><Link className="button" href="/meditations">← All meditations</Link></section>
    </main>
  )
}
