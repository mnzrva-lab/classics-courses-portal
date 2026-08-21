import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MarkdownContent from '@/components/markdown-content'
import RecordingPlayer from '@/components/recording-player'
import SessionTime from '@/components/session-time'
import PassageStudyTools from './passage-study-tools'
import { markSessionComplete, saveSessionNote, startSessionProgress, toggleSessionBookmark } from './actions'

type CourseRelation = {
  id: string
  slug: string
  title: string
  canonical_number: number | null
  status: string
}

type OfferingRelation = {
  id: string
  slug: string
  label: string
  status: string
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
  after_paragraph_id: string | null
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

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string; offeringSlug: string; sessionSlug: string }>
  searchParams: Promise<{ contentPreview?: string }>
}) {
  const { courseSlug, offeringSlug, sessionSlug } = await params
  const { contentPreview } = await searchParams
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  let adminContentPreview = false

  if (userId && contentPreview === '1') {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
    adminContentPreview = profile?.role === 'admin'
  }

  let sessionQuery = supabase
    .from('sessions')
    .select(`
      id, slug, code, title, session_type, status, recording_url, audio_url, starts_at, source_timezone,
      courses!inner(id, slug, title, canonical_number, status),
      course_offerings!inner(id, slug, label, status),
      session_teachers(teachers(full_name))
    `)
    .eq('slug', sessionSlug)
    .eq('courses.slug', courseSlug)
    .eq('course_offerings.slug', offeringSlug)

  if (!adminContentPreview) {
    sessionQuery = sessionQuery
      .eq('status', 'published')
      .eq('courses.status', 'published')
      .eq('course_offerings.status', 'published')
  }

  const { data: session } = await sessionQuery.single()
  if (!session) notFound()

  const course = session.courses as unknown as CourseRelation
  const offering = session.course_offerings as unknown as OfferingRelation

  const progressPromise = userId
    ? supabase.from('user_session_progress').select('started_at, completed_at, last_opened_at').eq('user_id', userId).eq('session_id', session.id).maybeSingle()
    : Promise.resolve({ data: null } as any)
  const notesPromise = userId
    ? supabase.from('student_notes').select('id, note, paragraph_id, updated_at').eq('user_id', userId).eq('session_id', session.id).order('updated_at', { ascending: false })
    : Promise.resolve({ data: [] } as any)
  const studyNotesPromise = adminContentPreview
    ? supabase.from('study_notes').select('title, summary, content_markdown, disclaimer, status').eq('session_id', session.id).maybeSingle()
    : supabase.from('study_notes').select('title, summary, content_markdown, disclaimer, status').eq('session_id', session.id).eq('status', 'published').maybeSingle()
  const transcriptPromise = adminContentPreview
    ? supabase.from('transcripts').select('id, title, disclaimer, status').eq('session_id', session.id).maybeSingle()
    : supabase.from('transcripts').select('id, title, disclaimer, status').eq('session_id', session.id).eq('status', 'published').maybeSingle()
  const materialsPromise = adminContentPreview
    ? supabase.from('materials').select('id, material_type, title, url, mime_type, storage_bucket, storage_path, status').eq('session_id', session.id).order('sort_order')
    : supabase.from('materials').select('id, material_type, title, url, mime_type, storage_bucket, storage_path, status').eq('session_id', session.id).eq('status', 'published').order('sort_order')
  const userSettingsPromise = userId
    ? supabase.from('user_settings').select('save_notes, save_bookmarks, save_progress').eq('user_id', userId).maybeSingle()
    : Promise.resolve({ data: null } as any)

  const [{ data: progress }, { data: notes }, { data: studyNotes }, { data: transcript }, { data: materials }, { data: userSettings }] = await Promise.all([
    progressPromise,
    notesPromise,
    studyNotesPromise,
    transcriptPromise,
    materialsPromise,
    userSettingsPromise,
  ])

  const canSaveNotes = userSettings?.save_notes ?? true
  const canSaveBookmarks = userSettings?.save_bookmarks ?? true
  const canSaveProgress = userSettings?.save_progress ?? true
  const sessionNotes = (notes ?? []).filter((note: any) => !note.paragraph_id)
  const passageNoteCounts = new Map<string, number>()
  for (const note of notes ?? []) {
    if (!note.paragraph_id) continue
    passageNoteCounts.set(note.paragraph_id, (passageNoteCounts.get(note.paragraph_id) ?? 0) + 1)
  }

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
      supabase.from('transcript_paragraphs').select('id, section_id, speaker, body, start_seconds, sort_order').eq('transcript_id', transcript.id).eq('is_active', true).order('sort_order'),
      supabase.from('transcript_assets').select('id, after_paragraph_sort_order, after_paragraph_id, storage_bucket, storage_path, mime_type, alt_text, caption, sort_order').eq('transcript_id', transcript.id).order('sort_order'),
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
  const firstParagraphBySection = new Map<string, TranscriptParagraph>()
  for (const paragraph of transcriptParagraphs) {
    if (paragraph.section_id && !firstParagraphBySection.has(paragraph.section_id)) firstParagraphBySection.set(paragraph.section_id, paragraph)
  }

  const assetsByParagraphId = new Map<string, ResolvedTranscriptAsset[]>()
  const legacyAssetsByPosition = new Map<number, ResolvedTranscriptAsset[]>()

  for (const asset of transcriptAssets) {
    if (asset.after_paragraph_id) {
      if (!assetsByParagraphId.has(asset.after_paragraph_id)) assetsByParagraphId.set(asset.after_paragraph_id, [])
      assetsByParagraphId.get(asset.after_paragraph_id)!.push(asset)
    } else {
      if (!legacyAssetsByPosition.has(asset.after_paragraph_sort_order)) legacyAssetsByPosition.set(asset.after_paragraph_sort_order, [])
      legacyAssetsByPosition.get(asset.after_paragraph_sort_order)!.push(asset)
    }
  }
  for (const assets of assetsByParagraphId.values()) assets.sort((a, b) => a.sort_order - b.sort_order)
  for (const assets of legacyAssetsByPosition.values()) assets.sort((a, b) => a.sort_order - b.sort_order)

  function renderAssetList(assets: ResolvedTranscriptAsset[]) {
    if (!assets.length) return null
    return assets.map((asset) => (
      <figure key={asset.id}>
        {asset.resolved_url ? (
          <img
            src={asset.resolved_url}
            alt={asset.alt_text ?? 'Transcript reference image'}
          />
        ) : (
          <div className="card"><span className="meta">Transcript image temporarily unavailable.</span></div>
        )}
        {asset.caption ? <figcaption className="meta">{asset.caption}</figcaption> : null}
      </figure>
    ))
  }

  function renderLeadingTranscriptAssets() {
    return renderAssetList(legacyAssetsByPosition.get(-1) ?? [])
  }

  function renderTranscriptAssets(paragraph: TranscriptParagraph) {
    const stableAssets = assetsByParagraphId.get(paragraph.id)
    if (stableAssets?.length) return renderAssetList(stableAssets)
    return renderAssetList(legacyAssetsByPosition.get(paragraph.sort_order) ?? [])
  }

  let previousSectionId: string | null | undefined = undefined
  const teachers = (session.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean)
  const publicReturnPath = `/courses/${courseSlug}/${offeringSlug}/${sessionSlug}`
  const returnPath = adminContentPreview ? `${publicReturnPath}?contentPreview=1` : publicReturnPath
  const isCompleted = Boolean(progress?.completed_at)
  const isInProgress = Boolean(progress && !progress.completed_at)

  return (
    <main className="container page">
      {adminContentPreview ? (
        <div className="card sage" style={{ marginBottom: 20 }}>
          <strong>Admin content preview</strong>
          <div className="meta">Draft and unpublished session content is visible only to an administrator in this preview mode.</div>
          <div className="actions">
            <Link className="button" href={`/admin/sessions/${session.id}`}>Edit session</Link>
            <Link className="button" href={`/admin/offerings/${offering.id}/review`}>Content review</Link>
          </div>
        </div>
      ) : null}

      <div className="actions" style={{ marginTop: 0, marginBottom: 18 }}>
        <Link className="button" href={`/courses/${courseSlug}/${offeringSlug}`}>← {offering.label}</Link>
      </div>
      <div className="eyebrow">{course.title} · {offering.label}</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>{session.code ? `${session.code} · ` : ''}{session.title}</h1>
      {teachers.length ? <p className="lead">{teachers.join(', ')}</p> : null}
      {session.starts_at ? <div className="meta"><SessionTime startsAt={session.starts_at} sourceTimezone={session.source_timezone} /></div> : null}

      <nav className="card" aria-label="Class contents" style={{ marginTop: 28 }}>
        <div className="eyebrow">In this class</div>
        <div className="actions" style={{ marginTop: 10 }}>
          <a className="button" href="#recording">Recording</a>
          <a className="button" href="#study-notes">Study Notes</a>
          {resolvedMaterials.length > 0 ? <a className="button" href="#materials">Materials</a> : null}
          <a className="button" href="#transcript">Reference Transcript</a>
          {userId ? <Link className="button" href="/my-notes">My Notes</Link> : null}
        </div>
      </nav>

      <section id="recording" className="section card" style={{ scrollMarginTop: 96 }}>
        <div className="eyebrow">Recording</div>
        <h2 style={{ fontSize: 32 }}>Watch or listen</h2>
        <RecordingPlayer recordingUrl={session.recording_url} title={session.title} />
        <div className="actions">
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

      {userId && sessionNotes.length > 0 && (
        <section className="section card">
          <div className="eyebrow">Your Class Notes</div>
          <div className="list">
            {sessionNotes.map((note: any) => (
              <div key={note.id} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                <div>{note.note}</div>
                <div className="meta">{new Date(note.updated_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="actions"><Link className="button" href="/my-notes">Open My Notes</Link></div>
        </section>
      )}

      <section id="study-notes" className="section card" style={{ scrollMarginTop: 96 }}>
        <div className="eyebrow">Study Notes{adminContentPreview && studyNotes?.status !== 'published' ? ` · ${studyNotes?.status ?? 'unpublished'}` : ''}</div>
        {studyNotes ? (
          <>
            <h2 style={{ fontSize: 32 }}>{studyNotes.title}</h2>
            {studyNotes.summary && <p className="lead" style={{ fontSize: 17 }}>{studyNotes.summary}</p>}
            <MarkdownContent content={studyNotes.content_markdown} />
            <p className="meta" style={{ marginTop: 18 }}>{studyNotes.disclaimer}</p>
          </>
        ) : <p className="meta">Study Notes have not been published for this session yet.</p>}
      </section>

      {resolvedMaterials.length > 0 && (
        <section id="materials" className="section card" style={{ scrollMarginTop: 96 }}>
          <div className="eyebrow">Class materials</div>
          <h2 style={{ fontSize: 32 }}>Readings, slides, and resources</h2>
          <div className="list">
            {resolvedMaterials.map((material: any) => (
              <div key={material.id} style={{ padding: '14px 0', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <strong>{material.title}</strong>
                  <div className="meta">{materialLabel(material.material_type)}{material.mime_type ? ` · ${material.mime_type}` : ''}{adminContentPreview && material.status !== 'published' ? ` · ${material.status}` : ''}</div>
                </div>
                {material.resolved_url ? <a className="button" href={material.resolved_url} target="_blank" rel="noreferrer">Open</a> : <span className="meta">File temporarily unavailable</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="transcript" className="section card" style={{ scrollMarginTop: 96 }}>
        {transcript ? (
          <>
            <p className="meta" style={{ marginBottom: 12 }}>{transcript.disclaimer}</p>
            <div className="eyebrow">Reference Transcript{adminContentPreview && transcript.status !== 'published' ? ` · ${transcript.status}` : ''}</div>
            <h2 style={{ fontSize: 32 }}>{transcript.title}</h2>

            {transcriptSections.length > 1 ? (
              <nav aria-label="Transcript chapters" className="note" style={{ margin: '20px 0 28px' }}>
                <strong>Chapters</strong>
                <div className="actions" style={{ marginTop: 10 }}>
                  {transcriptSections.map((section) => {
                    const firstParagraph = firstParagraphBySection.get(section.id)
                    const timestamp = formatTimestamp(section.start_seconds)
                    return (
                      <a className="button" key={section.id} href={firstParagraph ? `#paragraph-${firstParagraph.id}` : '#transcript'}>
                        {timestamp ? `${timestamp} · ` : ''}{section.title}
                      </a>
                    )
                  })}
                </div>
              </nav>
            ) : null}

            {transcriptParagraphs.length > 0 ? (
              <div style={{ maxWidth: 820 }}>
                {renderLeadingTranscriptAssets()}
                {transcriptParagraphs.map((paragraph) => {
                  const section = paragraph.section_id ? sectionMap.get(paragraph.section_id) : null
                  const showHeading = paragraph.section_id !== previousSectionId && Boolean(section)
                  previousSectionId = paragraph.section_id
                  const timestamp = formatTimestamp(paragraph.start_seconds)
                  const bookmarked = paragraphBookmarkIds.has(paragraph.id)
                  const noteCount = passageNoteCounts.get(paragraph.id) ?? 0
                  return (
                    <div key={paragraph.id} id={`paragraph-${paragraph.id}`} style={{ marginTop: showHeading ? 32 : 18, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
                      {showHeading ? <h3 style={{ fontSize: 24, marginBottom: 14 }}>{section?.title}</h3> : null}
                      <div style={{ lineHeight: 1.75 }}>
                        {timestamp ? <span className="meta" style={{ marginRight: 8 }}>{timestamp}</span> : null}
                        {paragraph.speaker ? <strong>{paragraph.speaker}: </strong> : null}
                        <span style={{ whiteSpace: 'pre-wrap' }}>{paragraph.body}</span>
                      </div>
                      {userId ? (
                        <PassageStudyTools
                          paragraphId={paragraph.id}
                          sessionId={session.id}
                          returnPath={returnPath}
                          bookmarked={bookmarked}
                          canSaveBookmarks={canSaveBookmarks}
                          canSaveNotes={canSaveNotes}
                          noteCount={noteCount}
                        />
                      ) : null}
                      {renderTranscriptAssets(paragraph)}
                    </div>
                  )
                })}
              </div>
            ) : transcriptAssets.length > 0 ? (
              <div style={{ maxWidth: 820 }}>{renderLeadingTranscriptAssets()}</div>
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
