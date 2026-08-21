import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { markSessionComplete, saveSessionNote, startSessionProgress, toggleParagraphBookmark, toggleSessionBookmark } from './actions'

type CourseRelation = {
  id: string
  slug: string
  title: string
  canonical_number: number | null
}

type OfferingRelation = {
  id: string
  slug: string
  label: string
}

type TranscriptSection = {
  id: string
  title: string
  start_seconds: number | null
}

type TranscriptParagraph = {
  id: string
  section_id: string | null
  speaker: string | null
  body: string
  start_seconds: number | null
  sort_order: number
}

type TranscriptAsset = {
  id: string
  after_paragraph_sort_order: number
  storage_bucket: string
  storage_path: string
  mime_type: string | null
  alt_text: string | null
  caption: string | null
  sort_order: number
}

type ResolvedTranscriptAsset = TranscriptAsset & { resolved_url: string | null }

function formatTimestamp(seconds: number | null) {
  if (seconds == null) return null
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function materialLabel(type: string) {
  const labels: Record<string, string> = {
    reading: 'Reading',
    slides: 'Slides',
    audio: 'Audio',
    video: 'Video',
    document: 'Document',
    link: 'Link',
    other: 'Resource',
  }
  return labels[type] ?? 'Resource'
}

export default async function SessionPage({ params }: { params: Promise<{ courseSlug: string; offeringSlug: string; sessionSlug: string }> }) {
  const { courseSlug, offeringSlug, sessionSlug } = await params
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, slug, code, title, session_type, recording_url, audio_url, starts_at, source_timezone,
      courses!inner(id, slug, title, canonical_number),
      course_offerings!inner(id, slug, label),
      session_teachers(teachers(full_name))
    `)
    .eq('slug', sessionSlug)
    .eq('courses.slug', courseSlug)
    .eq('course_offerings.slug', offeringSlug)
    .eq('status', 'published')
    .single()

  if (!session) notFound()

  const course = session.courses as unknown as CourseRelation
  const offering = session.course_offerings as unknown as OfferingRelation

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  const [{ data: progress }, { data: notes }, { data: studyNotes }, { data: transcript }, { data: materials }, { data: userSettings }] = await Promise.all([
    userId
      ? supabase.from('user_session_progress').select('started_at, completed_at, last_opened_at').eq('user_id', userId).eq('session_id', session.id).maybeSingle()
      : Promise.resolve({ data: null } as any),
    userId
      ? supabase.from('student_notes').select('id, note, updated_at').eq('user_id', userId).eq('session_id', session.id).order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] } as any),
    supabase.from('study_notes').select('title, summary, content_markdown, disclaimer').eq('session_id', session.id).eq('status', 'published').maybeSingle(),
    supabase.from('transcripts').select('id, title, disclaimer').eq('session_id', session.id).eq('status', 'published').maybeSingle(),
    supabase.from('materials').select('id, material_type, title, url, mime_type, storage_bucket, storage_path').eq('session_id', session.id).eq('status', 'published').order('sort_order'),
    userId
      ? supabase.from('user_settings').select('save_notes, save_bookmarks, save_progress').eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ])

  const canSaveNotes = userSettings?.save_notes ?? true
  const canSaveBookmarks = userSettings?.save_bookmarks ?? true
  const canSaveProgress = userSettings?.save_progress ?? true

  const resolvedMaterials = await Promise.all((materials ?? []).map(async (material: any) => {
    if (material.storage_bucket && material.storage_path) {
      const { data } = await supabase.storage
        .from(material.storage_bucket)
        .createSignedUrl(material.storage_path, 60 * 60)
      return { ...material, resolved_url: data?.signedUrl ?? null }
    }
    return { ...material, resolved_url: material.url ?? null }
  }))

  let transcriptSections: TranscriptSection[] = []
  let transcriptParagraphs: TranscriptParagraph[] = []
  let transcriptAssets: ResolvedTranscriptAsset[] = []
  if (transcript?.id) {
    const [{ data: sections }, { data: paragraphs }, { data: assets }] = await Promise.all([
      supabase.from('transcript_sections').select('id, title, start_seconds').eq('transcript_id', transcript.id).order('sort_order'),
      supabase.from('transcript_paragraphs').select('id, section_id, speaker, body, start_seconds, sort_order').eq('transcript_id', transcript.id).order('sort_order'),
      supabase.from('transcript_assets').select('id, after_paragraph_sort_order, storage_bucket, storage_path, mime_type, alt_text, caption, sort_order').eq('transcript_id', transcript.id).order('sort_order'),
    ])
    transcriptSections = (sections ?? []) as TranscriptSection[]
    transcriptParagraphs = (paragraphs ?? []) as TranscriptParagraph[]
    transcriptAssets = await Promise.all(((assets ?? []) as TranscriptAsset[]).map(async (asset) => {
      const { data } = await supabase.storage
        .from(asset.storage_bucket)
        .createSignedUrl(asset.storage_path, 60 * 60)
      return { ...asset, resolved_url: data?.signedUrl ?? null }
    }))
  }

  let sessionBookmarked = false
  const paragraphBookmarkIds = new Set<string>()
  if (userId) {
    const paragraphIds = transcriptParagraphs.map((paragraph) => paragraph.id)
    const [{ data: sessionBookmark }, paragraphBookmarksResult] = await Promise.all([
      supabase.from('user_session_bookmarks').select('session_id').eq('user_id', userId).eq('session_id', session.id).maybeSingle(),
      paragraphIds.length > 0
        ? supabase.from('user_paragraph_bookmarks').select('paragraph_id').eq('user_id', userId).in('paragraph_id', paragraphIds)
        : Promise.resolve({ data: [] } as any),
    ])
    sessionBookmarked = Boolean(sessionBookmark)
    for (const bookmark of paragraphBookmarksResult.data ?? []) paragraphBookmarkIds.add(bookmark.paragraph_id)
  }

  const sectionMap = new Map(transcriptSections.map((section) => [section.id, section]))
  const assetsByPosition = new Map<number, ResolvedTranscriptAsset[]>()
  for (const asset of transcriptAssets) {
    if (!assetsByPosition.has(asset.after_paragraph_sort_order)) assetsByPosition.set(asset.after_paragraph_sort_order, [])
    assetsByPosition.get(asset.after_paragraph_sort_order)!.push(asset)
  }
  for (const assets of assetsByPosition.values()) assets.sort((a, b) => a.sort_order - b.sort_order)

  function renderTranscriptAssets(position: number) {
    const assets = assetsByPosition.get(position) ?? []
    if (!assets.length) return null
    return assets.map((asset) => (
      <figure key={asset.id} style={{ margin: '20px 0 8px' }}>
        {asset.resolved_url ? (
          <img
            src={asset.resolved_url}
            alt={asset.alt_text ?? 'Transcript reference image'}
            style={{ display: 'block', maxWidth: '100%', height: 'auto', borderRadius: 16, border: '1px solid var(--line)' }}
          />
        ) : (
          <div className="card"><span className="meta">Transcript image temporarily unavailable.</span></div>
        )}
        {asset.caption ? <figcaption className="meta" style={{ marginTop: 8 }}>{asset.caption}</figcaption> : null}
      </figure>
    ))
  }

  let previousSectionId: string | null | undefined = undefined
  const teachers = (session.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean)
  const returnPath = `/courses/${courseSlug}/${offeringSlug}/${sessionSlug}`
  const isCompleted = Boolean(progress?.completed_at)
  const isInProgress = Boolean(progress && !progress.completed_at)

  return (
    <main className="container page">
      <div className="eyebrow">{course.title} · {offering.label}</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>{session.code ? `${session.code} · ` : ''}{session.title}</h1>
      <p className="lead">{teachers.join(', ')}</p>

      <section className="section card">
        <div className="eyebrow">Recording</div>
        <h2 style={{ fontSize: 32 }}>Watch or listen</h2>
        <div className="actions">
          {session.recording_url ? <a className="button red" href={session.recording_url} target="_blank" rel="noreferrer">Open recording</a> : <span className="meta">Recording coming soon.</span>}
          {session.audio_url ? <audio controls src={session.audio_url} /> : null}
          {userId && (canSaveBookmarks || sessionBookmarked) ? (
            <form action={toggleSessionBookmark.bind(null, session.id, returnPath)}>
              <button className="button" type="submit">{sessionBookmarked ? '★ Bookmarked' : '☆ Bookmark class'}</button>
            </form>
          ) : userId ? <Link className="button" href="/account">Bookmarks are off</Link> : null}
        </div>
      </section>

      <section className="grid two section">
        <div className={isCompleted ? 'card completed' : isInProgress ? 'card sage' : 'card'}>
          <div className="eyebrow">Progress</div>
          <h3>{isCompleted ? '✓ Completed' : isInProgress ? 'In progress' : 'Not started'}</h3>
          {userId ? (
            canSaveProgress ? (
              isCompleted ? (
                <p className="meta">You can revisit this class anytime.</p>
              ) : isInProgress ? (
                <form action={markSessionComplete.bind(null, session.id, returnPath)}>
                  <button className="button sage" type="submit">Mark Complete</button>
                </form>
              ) : (
                <form action={startSessionProgress.bind(null, session.id, returnPath)}>
                  <button className="button sage" type="submit">Start studying</button>
                </form>
              )
            ) : (
              <p className="meta">Progress saving is off. <Link href="/account">Change Privacy &amp; Data settings</Link>.</p>
            )
          ) : (
            <div className="actions"><Link className="button" href="/login">Sign in to save progress</Link></div>
          )}
        </div>

        <div className="card">
          <div className="eyebrow">Private note</div>
          <h3>Save something for later</h3>
          {userId ? (
            canSaveNotes ? (
              <form className="form-stack" action={saveSessionNote.bind(null, session.id, returnPath)}>
                <textarea className="input" name="note" rows={5} placeholder="Write a private study note…" required />
                <button className="button" type="submit">Save note</button>
              </form>
            ) : (
              <p className="meta">Note saving is off. <Link href="/account">Change Privacy &amp; Data settings</Link>.</p>
            )
          ) : (
            <div className="actions"><Link className="button" href="/login">Sign in to save notes</Link></div>
          )}
        </div>
      </section>

      {userId && (notes ?? []).length > 0 && (
        <section className="section card">
          <div className="eyebrow">Your Notes</div>
          <div className="list">
            {(notes ?? []).map((note: any) => (
              <div key={note.id} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                <div>{note.note}</div>
                <div className="meta">{new Date(note.updated_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section card">
        <div className="eyebrow">Study Notes</div>
        {studyNotes ? (
          <>
            <h2 style={{ fontSize: 32 }}>{studyNotes.title}</h2>
            {studyNotes.summary && <p className="lead" style={{ fontSize: 17 }}>{studyNotes.summary}</p>}
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{studyNotes.content_markdown}</div>
            <p className="meta" style={{ marginTop: 18 }}>{studyNotes.disclaimer}</p>
          </>
        ) : <p className="meta">Study Notes have not been published for this session yet.</p>}
      </section>

      {resolvedMaterials.length > 0 && (
        <section className="section card">
          <div className="eyebrow">Class materials</div>
          <h2 style={{ fontSize: 32 }}>Readings, slides, and resources</h2>
          <div className="list">
            {resolvedMaterials.map((material: any) => (
              <div key={material.id} style={{ padding: '14px 0', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <strong>{material.title}</strong>
                  <div className="meta">{materialLabel(material.material_type)}{material.mime_type ? ` · ${material.mime_type}` : ''}</div>
                </div>
                {material.resolved_url ? <a className="button" href={material.resolved_url} target="_blank" rel="noreferrer">Open</a> : <span className="meta">File temporarily unavailable</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section card">
        {transcript ? (
          <>
            <p className="meta" style={{ marginBottom: 12 }}>{transcript.disclaimer}</p>
            <div className="eyebrow">Reference Transcript</div>
            <h2 style={{ fontSize: 32 }}>{transcript.title}</h2>
            {transcriptParagraphs.length > 0 ? (
              <div style={{ maxWidth: 820 }}>
                {renderTranscriptAssets(-1)}
                {transcriptParagraphs.map((paragraph) => {
                  const section = paragraph.section_id ? sectionMap.get(paragraph.section_id) : null
                  const showHeading = paragraph.section_id !== previousSectionId && Boolean(section)
                  previousSectionId = paragraph.section_id
                  const timestamp = formatTimestamp(paragraph.start_seconds)
                  const bookmarked = paragraphBookmarkIds.has(paragraph.id)
                  return (
                    <div key={paragraph.id} id={`paragraph-${paragraph.id}`} style={{ marginTop: showHeading ? 32 : 18, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
                      {showHeading ? <h3 style={{ fontSize: 24, marginBottom: 14 }}>{section?.title}</h3> : null}
                      <div style={{ lineHeight: 1.75 }}>
                        {timestamp ? <span className="meta" style={{ marginRight: 8 }}>{timestamp}</span> : null}
                        {paragraph.speaker ? <strong>{paragraph.speaker}: </strong> : null}
                        <span style={{ whiteSpace: 'pre-wrap' }}>{paragraph.body}</span>
                      </div>
                      {userId && (canSaveBookmarks || bookmarked) ? (
                        <form action={toggleParagraphBookmark.bind(null, paragraph.id, returnPath)} style={{ marginTop: 8 }}>
                          <button className="button" type="submit" style={{ padding: '7px 10px', fontSize: 13 }}>{bookmarked ? '★ Saved passage' : '☆ Save passage'}</button>
                        </form>
                      ) : null}
                      {renderTranscriptAssets(paragraph.sort_order)}
                    </div>
                  )
                })}
              </div>
            ) : transcriptAssets.length > 0 ? (
              <div style={{ maxWidth: 820 }}>{renderTranscriptAssets(-1)}</div>
            ) : <p className="meta">Transcript metadata is published, but no paragraphs have been imported yet.</p>}
          </>
        ) : (
          <>
            <div className="eyebrow">Reference Transcript</div>
            <p className="meta">Reference transcript has not been uploaded for this session yet.</p>
          </>
        )}
      </section>

      <section className="section">
        <Link className="button" href={`/courses/${courseSlug}/${offeringSlug}`}>← Back to {offering.label}</Link>
      </section>
    </main>
  )
}
