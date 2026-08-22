import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MarkdownContent from '@/components/markdown-content'
import CopyReference from '@/components/copy-reference'
import { toggleMeditationBookmark } from './actions'

export const dynamic = 'force-dynamic'

function formatDuration(seconds: number | null) {
  if (!seconds) return 'Duration not added'
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes <= 15) return `Quick · ${minutes} min`
  if (minutes <= 29) return `Medium · ${minutes} min`
  return `Full · ${minutes} min`
}

function formatTimestamp(seconds: number | null | undefined) {
  if (seconds == null) return null
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default async function MeditationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ version?: string }>
}) {
  const { slug } = await params
  const { version } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

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
      id, title, start_seconds, end_seconds, duration_seconds, audio_url, created_at,
      teachers(full_name),
      sessions(id, slug, code, title, audio_url, recording_url, courses(slug, title, canonical_number), course_offerings(slug, label))
    `)
    .eq('meditation_id', meditation.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  const publishedInstances = instances ?? []
  const selected = (publishedInstances as any[]).find((instance) => instance.id === version) ?? (publishedInstances as any[])[0] ?? null
  const selectedSession = selected?.sessions ?? null
  const sourceCourse = selectedSession?.courses ?? null
  const sourceOffering = selectedSession?.course_offerings ?? null
  const sourcePath = sourceCourse?.slug && sourceOffering?.slug && selectedSession?.slug
    ? `/courses/${sourceCourse.slug}/${sourceOffering.slug}/${selectedSession.slug}`
    : null

  const bookmarkPromise = userId
    ? supabase.from('user_meditation_bookmarks').select('meditation_id').eq('user_id', userId).eq('meditation_id', meditation.id).maybeSingle()
    : Promise.resolve({ data: null } as any)
  const settingsPromise = userId
    ? supabase.from('user_settings').select('save_bookmarks').eq('user_id', userId).maybeSingle()
    : Promise.resolve({ data: null } as any)
  const studyNotesPromise = selectedSession?.id
    ? supabase.from('study_notes').select('title, summary, content_markdown, disclaimer').eq('session_id', selectedSession.id).eq('status', 'published').maybeSingle()
    : Promise.resolve({ data: null } as any)
  const transcriptPromise = selectedSession?.id
    ? supabase.from('transcripts').select('id, title, disclaimer').eq('session_id', selectedSession.id).eq('status', 'published').maybeSingle()
    : Promise.resolve({ data: null } as any)

  const [{ data: bookmark }, { data: settings }, { data: studyNotes }, { data: transcript }] = await Promise.all([
    bookmarkPromise,
    settingsPromise,
    studyNotesPromise,
    transcriptPromise,
  ])

  let transcriptParagraphs: any[] = []
  if (transcript?.id) {
    const { data } = await supabase
      .from('transcript_paragraphs')
      .select('id, speaker, body, start_seconds, sort_order')
      .eq('transcript_id', transcript.id)
      .eq('is_active', true)
      .order('sort_order')

    transcriptParagraphs = (data ?? []).filter((paragraph: any) => {
      if (paragraph.start_seconds == null) return true
      if (selected?.start_seconds != null && paragraph.start_seconds < selected.start_seconds) return false
      if (selected?.end_seconds != null && paragraph.start_seconds > selected.end_seconds) return false
      return true
    })
  }

  const audioUrl = selected?.audio_url || selectedSession?.audio_url || null
  const teacher = selected?.teachers?.full_name ?? null
  const selectedDuration = selected?.duration_seconds ?? (
    selected?.start_seconds != null && selected?.end_seconds != null
      ? Math.max(0, selected.end_seconds - selected.start_seconds)
      : null
  )
  const bookmarked = Boolean(bookmark)
  const canSaveBookmarks = settings?.save_bookmarks ?? true
  const returnPath = version ? `/meditations/${slug}?version=${encodeURIComponent(version)}` : `/meditations/${slug}`
  const sourceReferenceBase = [
    sourceCourse?.canonical_number ? `Course ${sourceCourse.canonical_number}` : sourceCourse?.title,
    sourceOffering?.label,
    selectedSession?.title,
  ].filter(Boolean).join(' · ')

  return (
    <main className="container page">
      <div className="eyebrow">Meditation</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>{meditation.name}</h1>
      {meditation.description ? <p className="lead">{meditation.description}</p> : null}
      {(meditation.topics ?? []).length ? (
        <div className="actions">{meditation.topics.map((topic: string) => <span className="pill" key={topic}>{topic}</span>)}</div>
      ) : null}
      <div className="actions">
        {userId && (canSaveBookmarks || bookmarked) ? (
          <form action={toggleMeditationBookmark.bind(null, meditation.id, returnPath)}>
            <button className="button" type="submit">{bookmarked ? '★ Meditation saved' : '☆ Save meditation'}</button>
          </form>
        ) : userId ? <Link className="button" href="/account">Bookmarks are off</Link> : <Link className="button" href="/login">Sign in to save</Link>}
      </div>

      {selected ? (
        <section className="section card sage">
          <div className="eyebrow">Selected practice</div>
          <h2 style={{ fontSize: 34 }}>{selected.title || selectedSession?.title || meditation.name}</h2>
          <p className="meta">
            {formatDuration(selectedDuration)}
            {teacher ? ` · ${teacher}` : ''}
            {sourceCourse?.title ? ` · ${sourceCourse.title}` : ''}
            {sourceOffering?.label ? ` · ${sourceOffering.label}` : ''}
          </p>

          {audioUrl ? <audio controls src={audioUrl} style={{ width: '100%', marginTop: 16 }} /> : null}
          {!audioUrl ? <p className="meta" style={{ marginTop: 16 }}>A dedicated audio file has not been added for this version yet.</p> : null}

          <div className="actions">
            {sourcePath ? <Link className="button" href={sourcePath}>Open source class</Link> : null}
            {!audioUrl && selectedSession?.recording_url ? <a className="button" href={selectedSession.recording_url} target="_blank" rel="noreferrer">Open source recording</a> : null}
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="eyebrow">Versions</div>
        <h2>Practice from different teachings</h2>
        {publishedInstances.length ? (
          <div className="grid two">
            {(publishedInstances as any[]).map((instance) => {
              const session = instance.sessions
              const course = session?.courses
              const offering = session?.course_offerings
              const versionTeacher = instance.teachers?.full_name
              const active = selected?.id === instance.id
              return (
                <Link className={active ? 'card sage' : 'card'} key={instance.id} href={`/meditations/${slug}?version=${encodeURIComponent(instance.id)}`}>
                  <div className="eyebrow">{formatDuration(instance.duration_seconds)}</div>
                  <h3>{instance.title || session?.title || meditation.name}</h3>
                  <p className="meta">
                    {versionTeacher ? `${versionTeacher} · ` : ''}
                    {course?.title ?? 'Source teaching'}{offering?.label ? ` · ${offering.label}` : ''}
                  </p>
                  {active ? <span className="pill">Selected</span> : <span className="pill">Choose version</span>}
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="card"><p className="meta">No published versions are available yet.</p></div>
        )}
      </section>

      {selected && studyNotes ? (
        <section className="section card">
          <div className="eyebrow">Study Notes</div>
          <h2 style={{ fontSize: 32 }}>{studyNotes.title}</h2>
          {studyNotes.summary ? <p className="lead" style={{ fontSize: 17 }}>{studyNotes.summary}</p> : null}
          <MarkdownContent content={studyNotes.content_markdown} />
          <p className="meta" style={{ marginTop: 18 }}>{studyNotes.disclaimer}</p>
        </section>
      ) : null}

      {selected && transcript ? (
        <section className="section card">
          <p className="meta" style={{ marginBottom: 12 }}>{transcript.disclaimer}</p>
          <div className="eyebrow">Reference Transcript</div>
          <h2 style={{ fontSize: 32 }}>{transcript.title}</h2>
          {selected?.start_seconds != null || selected?.end_seconds != null ? (
            <p className="meta">Showing the transcript range connected to this meditation version.</p>
          ) : null}

          {transcriptParagraphs.length ? (
            <div style={{ maxWidth: 820 }}>
              {transcriptParagraphs.map((paragraph: any) => {
                const timestamp = formatTimestamp(paragraph.start_seconds)
                const paragraphPath = sourcePath ? `${sourcePath}#paragraph-${paragraph.id}` : null
                const reference = [sourceReferenceBase, timestamp].filter(Boolean).join(' · ')
                return (
                  <div key={paragraph.id} style={{ padding: '14px 0', borderTop: '1px solid var(--line)' }}>
                    <div style={{ lineHeight: 1.7 }}>
                      {timestamp ? <span className="meta" style={{ marginRight: 8 }}>{timestamp}</span> : null}
                      {paragraph.speaker ? <strong>{paragraph.speaker}: </strong> : null}
                      <span style={{ whiteSpace: 'pre-wrap' }}>{paragraph.body}</span>
                    </div>
                    {paragraphPath ? (
                      <div className="actions">
                        <Link className="button" href={paragraphPath}>Open source passage</Link>
                        <CopyReference reference={reference} path={paragraphPath} />
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : <p className="meta">No published transcript text is available for this version yet.</p>}
        </section>
      ) : null}

      <section className="section"><Link className="button" href="/meditations">← All meditations</Link></section>
    </main>
  )
}
