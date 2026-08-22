import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MarkdownContent from '@/components/markdown-content'
import RecordingPlayer from '@/components/recording-player'
import SessionTime from '@/components/session-time'
import TranscriptControls from '@/components/transcript-controls'
import PassageStudyTools from './passage-study-tools'
import { saveSessionNote, toggleSessionBookmark, toggleSessionComplete } from './actions'

type CourseRelation = { id: string; slug: string; title: string; canonical_number: number | null; status: string }
type OfferingRelation = { id: string; slug: string; label: string; status: string }
type TranscriptSection = { id: string; title: string; start_seconds: number | null }
type TranscriptParagraph = { id: string; section_id: string | null; speaker: string | null; body: string; start_seconds: number | null; sort_order: number }
type TranscriptAsset = { id: string; after_paragraph_sort_order: number; after_paragraph_id: string | null; storage_bucket: string; storage_path: string; mime_type: string | null; alt_text: string | null; caption: string | null; sort_order: number }
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
  const labels: Record<string, string> = { reading: 'Reading', slides: 'Slides', audio: 'Audio', video: 'Video', document: 'Document', link: 'Link', other: 'Resource' }
  return labels[type] ?? 'Resource'
}

function topicHeadings(markdown: string | null | undefined) {
  if (!markdown) return []
  const headings = markdown.split(/\r?\n/)
    .map((line) => line.match(/^#{2,4}\s+(.+)$/)?.[1]?.replace(/[*_`]/g, '').trim())
    .filter(Boolean) as string[]
  return Array.from(new Set(headings)).slice(0, 8)
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

  if (!adminContentPreview) sessionQuery = sessionQuery.eq('status', 'published').eq('courses.status', 'published').eq('course_offerings.status', 'published')
  const { data: session } = await sessionQuery.single()
  if (!session) notFound()

  const course = session.courses as unknown as CourseRelation
  const offering = session.course_offerings as unknown as OfferingRelation

  const [progressResult, notesResult, studyNotesResult, transcriptResult, materialsResult, offeringMaterialsResult, userSettingsResult] = await Promise.all([
    userId ? supabase.from('user_session_progress').select('started_at, completed_at, last_opened_at').eq('user_id', userId).eq('session_id', session.id).maybeSingle() : Promise.resolve({ data: null } as any),
    userId ? supabase.from('student_notes').select('id, note, paragraph_id, updated_at').eq('user_id', userId).eq('session_id', session.id).order('updated_at', { ascending: false }) : Promise.resolve({ data: [] } as any),
    adminContentPreview ? supabase.from('study_notes').select('title, summary, content_markdown, disclaimer, status').eq('session_id', session.id).maybeSingle() : supabase.from('study_notes').select('title, summary, content_markdown, disclaimer, status').eq('session_id', session.id).eq('status', 'published').maybeSingle(),
    adminContentPreview ? supabase.from('transcripts').select('id, title, disclaimer, status').eq('session_id', session.id).maybeSingle() : supabase.from('transcripts').select('id, title, disclaimer, status').eq('session_id', session.id).eq('status', 'published').maybeSingle(),
    adminContentPreview ? supabase.from('materials').select('id, material_type, title, url, mime_type, storage_bucket, storage_path, status').eq('session_id', session.id).order('sort_order') : supabase.from('materials').select('id, material_type, title, url, mime_type, storage_bucket, storage_path, status').eq('session_id', session.id).eq('status', 'published').order('sort_order'),
    adminContentPreview ? supabase.from('materials').select('id, material_type, title, url, mime_type, storage_bucket, storage_path, status').eq('offering_id', offering.id).is('session_id', null).order('sort_order') : supabase.from('materials').select('id, material_type, title, url, mime_type, storage_bucket, storage_path, status').eq('offering_id', offering.id).is('session_id', null).eq('status', 'published').order('sort_order'),
    userId ? supabase.from('user_settings').select('save_notes, save_bookmarks, save_progress').eq('user_id', userId).maybeSingle() : Promise.resolve({ data: null } as any),
  ])

  const progress = progressResult.data
  const notes = notesResult.data ?? []
  const studyNotes = studyNotesResult.data
  const transcript = transcriptResult.data
  const materials = materialsResult.data ?? []
  const offeringMaterials = offeringMaterialsResult.data ?? []
  const userSettings = userSettingsResult.data
  const canSaveNotes = userSettings?.save_notes ?? true
  const canSaveBookmarks = userSettings?.save_bookmarks ?? true
  const canSaveProgress = userSettings?.save_progress ?? true
  const sessionNotes = notes.filter((note: any) => !note.paragraph_id)
  const passageNoteCounts = new Map<string, number>()
  for (const note of notes) if (note.paragraph_id) passageNoteCounts.set(note.paragraph_id, (passageNoteCounts.get(note.paragraph_id) ?? 0) + 1)

  async function resolveMaterials(rows: any[]) {
    return Promise.all(rows.map(async (material: any) => {
      if (material.storage_bucket && material.storage_path) {
        const { data } = await supabase.storage.from(material.storage_bucket).createSignedUrl(material.storage_path, 60 * 60)
        return { ...material, resolved_url: data?.signedUrl ?? null }
      }
      return { ...material, resolved_url: material.url ?? null }
    }))
  }
  const [resolvedMaterials, resolvedOfferingMaterials] = await Promise.all([resolveMaterials(materials), resolveMaterials(offeringMaterials)])
  const compactResources = [
    ...resolvedOfferingMaterials.map((material: any) => ({ ...material, resource_scope: 'Course' })),
    ...resolvedMaterials.map((material: any) => ({ ...material, resource_scope: 'Class' })),
  ].filter((material: any) => Boolean(material.resolved_url))

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
      const { data } = await supabase.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, 60 * 60)
      return { ...asset, resolved_url: data?.signedUrl ?? null }
    }))
  }

  let sessionBookmarked = false
  const paragraphBookmarkIds = new Set<string>()
  if (userId) {
    const paragraphIds = transcriptParagraphs.map((paragraph) => paragraph.id)
    const [{ data: sessionBookmark }, paragraphBookmarksResult] = await Promise.all([
      supabase.from('user_session_bookmarks').select('session_id').eq('user_id', userId).eq('session_id', session.id).maybeSingle(),
      paragraphIds.length ? supabase.from('user_paragraph_bookmarks').select('paragraph_id').eq('user_id', userId).in('paragraph_id', paragraphIds) : Promise.resolve({ data: [] } as any),
    ])
    sessionBookmarked = Boolean(sessionBookmark)
    for (const bookmark of paragraphBookmarksResult.data ?? []) paragraphBookmarkIds.add(bookmark.paragraph_id)
  }

  const sectionMap = new Map(transcriptSections.map((section) => [section.id, section]))
  const firstParagraphBySection = new Map<string, TranscriptParagraph>()
  for (const paragraph of transcriptParagraphs) if (paragraph.section_id && !firstParagraphBySection.has(paragraph.section_id)) firstParagraphBySection.set(paragraph.section_id, paragraph)

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
        {asset.resolved_url ? <img src={asset.resolved_url} alt={asset.alt_text ?? 'Transcript reference image'} /> : <div className="card"><span className="meta">Transcript image temporarily unavailable.</span></div>}
        {asset.caption ? <figcaption className="meta">{asset.caption}</figcaption> : null}
      </figure>
    ))
  }
  function renderLeadingTranscriptAssets() { return renderAssetList(legacyAssetsByPosition.get(-1) ?? []) }
  function renderTranscriptAssets(paragraph: TranscriptParagraph) {
    const stableAssets = assetsByParagraphId.get(paragraph.id)
    return stableAssets?.length ? renderAssetList(stableAssets) : renderAssetList(legacyAssetsByPosition.get(paragraph.sort_order) ?? [])
  }

  let previousSectionId: string | null | undefined = undefined
  const teachers = (session.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean)
  const publicReturnPath = `/courses/${courseSlug}/${offeringSlug}/${sessionSlug}`
  const returnPath = adminContentPreview ? `${publicReturnPath}?contentPreview=1` : publicReturnPath
  const citationCourse = course.canonical_number ? `Course ${course.canonical_number}` : course.title
  const isCompleted = Boolean(progress?.completed_at)
  const topics = topicHeadings(studyNotes?.content_markdown)
  const downloadBase = `${publicReturnPath}/download`
  const transcriptChapterOptions = transcriptSections.map((section) => {
    const firstParagraph = firstParagraphBySection.get(section.id)
    return { id: firstParagraph ? `paragraph-${firstParagraph.id}` : 'transcript', label: section.title }
  })

  return (
    <main className="container page">
      {adminContentPreview ? <div className="card sage" style={{ marginBottom: 20 }}><strong>Admin content preview</strong><div className="meta">Draft and unpublished session content is visible only to an administrator in this preview mode.</div><div className="actions"><Link className="button" href={`/admin/sessions/${session.id}`}>Edit session</Link><Link className="button" href={`/admin/offerings/${offering.id}/review`}>Content review</Link></div></div> : null}

      <div className="actions" style={{ marginTop: 0, marginBottom: 18 }}><Link className="button" href={`/courses/${courseSlug}/${offeringSlug}`}>← {offering.label}</Link></div>
      <div className="eyebrow">{course.title} · {offering.label}</div>
      <h1 className="class-title">{session.code ? `${session.code} · ` : ''}{session.title}</h1>
      {teachers.length ? <p className="lead">{teachers.join(', ')}</p> : null}
      {session.starts_at ? <div className="meta"><SessionTime startsAt={session.starts_at} sourceTimezone={session.source_timezone} /></div> : null}

      <nav className="card" aria-label="Class contents" style={{ marginTop: 28 }}>
        <div className="eyebrow">In this class</div>
        <div className="actions" style={{ marginTop: 10 }}>
          <a className="button" href="#recording">Recording</a>
          <a className="button" href="#study-notes">Study Notes</a>
          <a className="button" href="#transcript">Reference Transcript</a>
          {userId ? <Link className="button" href="/my-notes">My Notes</Link> : null}
        </div>
      </nav>

      <section id="recording" className="section" style={{ scrollMarginTop: 96 }}>
        <div className="eyebrow">Recording</div><h2>Watch or listen</h2>
        <div className="recording-layout">
          <div className="recording-main">
            <RecordingPlayer recordingUrl={session.recording_url} title={session.title} />
            {session.audio_url ? <audio controls src={session.audio_url} /> : null}
          </div>

          <aside className="recording-study-tools" aria-label="Class study actions">
            <div className="eyebrow">Your study</div>
            {userId ? (canSaveProgress || isCompleted) ? (
              <form action={toggleSessionComplete.bind(null, session.id, returnPath)}>
                <button
                  className={isCompleted ? 'button sage recording-tool-button is-active' : 'button sage recording-tool-button'}
                  type="submit"
                  aria-pressed={isCompleted}
                  title={isCompleted ? 'Mark this class incomplete' : 'Mark this class completed'}
                >
                  {isCompleted ? '✓ Completed' : '○ Mark completed'}
                </button>
              </form>
            ) : <Link className="button recording-tool-button" href="/account">Progress is off</Link> : <Link className="button recording-tool-button" href="/login">Sign in to track progress</Link>}

            {userId && (canSaveBookmarks || sessionBookmarked) ? (
              <form action={toggleSessionBookmark.bind(null, session.id, returnPath)}>
                <button
                  className={sessionBookmarked ? 'button recording-tool-button is-active' : 'button recording-tool-button'}
                  type="submit"
                  aria-pressed={sessionBookmarked}
                  title={sessionBookmarked ? 'Remove bookmark' : 'Bookmark this class'}
                >
                  {sessionBookmarked ? '★ Bookmarked' : '☆ Bookmark class'}
                </button>
              </form>
            ) : userId ? <Link className="button recording-tool-button" href="/account">Bookmarks are off</Link> : null}

            {userId && canSaveNotes ? (
              <details className="recording-note-details">
                <summary className="button recording-tool-button">✎ Add private note{sessionNotes.length ? ` · ${sessionNotes.length}` : ''}</summary>
                <div className="recording-note-panel">
                  <p className="meta">For notes tied to an exact teaching, use the note control beside that passage in the Reference Transcript.</p>
                  <form className="form-stack" action={saveSessionNote.bind(null, session.id, returnPath)}>
                    <textarea className="input" name="note" rows={4} placeholder="General note about this class…" required />
                    <button className="button" type="submit">Save note</button>
                  </form>
                  {sessionNotes.length ? (
                    <div className="recording-saved-notes">
                      <strong>General class notes</strong>
                      {sessionNotes.map((note: any) => <div key={note.id}><p>{note.note}</p><span className="meta">{new Date(note.updated_at).toLocaleString()}</span></div>)}
                      <Link href="/my-notes">Open My Notes →</Link>
                    </div>
                  ) : null}
                </div>
              </details>
            ) : userId ? <Link className="button recording-tool-button" href="/account">Notes are off</Link> : null}

            {compactResources.length ? (
              <div className="recording-resource-list">
                <div className="recording-resource-title">Resources</div>
                {compactResources.map((material: any) => (
                  <a className="recording-resource-link" key={`${material.resource_scope}-${material.id}`} href={material.resolved_url} target="_blank" rel="noreferrer">
                    <span>{materialLabel(material.material_type)}</span>
                    <strong>{material.title}</strong>
                    <small>{material.resource_scope} ↗</small>
                  </a>
                ))}
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <section id="study-notes" className="section" style={{ scrollMarginTop: 96 }}>
        <div className="study-notes-head">
          <div><div className="eyebrow">Study aid{adminContentPreview && studyNotes?.status !== 'published' ? ` · ${studyNotes?.status ?? 'unpublished'}` : ''}</div><h2>Study Notes</h2></div>
          {studyNotes ? <div className="text-downloads"><span>Download</span><a href={`${downloadBase}?kind=study-notes&format=txt`}>TXT</a><span>·</span><a href={`${downloadBase}?kind=study-notes&format=docx`}>DOCX</a></div> : null}
        </div>
        {studyNotes ? <>
          <div className="info-callout"><strong>About these notes</strong><br />{studyNotes.disclaimer || 'These study notes were created from the class with the assistance of AI and are provided as a study aid. They may simplify or omit parts of the teaching. Please refer to the recording and transcript for the complete class.'}</div>
          <div className="study-notes-summary card">
            <div className="eyebrow">Covered in this class</div><h3>Top ideas</h3>
            {studyNotes.summary ? <p>{studyNotes.summary}</p> : <p className="meta">A short summary has not been added yet.</p>}
            {topics.length ? <div className="study-topic-list">{topics.map((topic) => <span className="pill" key={topic}>{topic}</span>)}</div> : null}
            <details className="full-study-notes"><summary>▶ View full study notes</summary><div className="full-study-notes-body"><MarkdownContent content={studyNotes.content_markdown} /></div></details>
          </div>
        </> : <div className="card"><p className="meta">Study Notes have not been published for this session yet.</p></div>}
      </section>

      <section id="transcript" className="section transcript-section-v12" style={{ scrollMarginTop: 96 }}>
        {transcript ? <>
          <div className="transcript-title-row">
            <div><div className="eyebrow">Source reference{adminContentPreview && transcript.status !== 'published' ? ` · ${transcript.status}` : ''}</div><h2>Reference Transcript</h2></div>
            <div className="text-downloads"><span>Download</span><a href={`${downloadBase}?kind=transcript&format=txt`}>TXT</a><span>·</span><a href={`${downloadBase}?kind=transcript&format=docx`}>DOCX</a></div>
          </div>
          <div className="info-callout"><strong>About this transcript</strong><br />{transcript.disclaimer}</div>
          <TranscriptControls chapters={transcriptChapterOptions} />
          {transcriptParagraphs.length > 0 ? <article className="transcript-v12-card">
            {renderLeadingTranscriptAssets()}
            {transcriptParagraphs.map((paragraph) => {
              const section = paragraph.section_id ? sectionMap.get(paragraph.section_id) : null
              const showHeading = paragraph.section_id !== previousSectionId && Boolean(section)
              previousSectionId = paragraph.section_id
              const timestamp = formatTimestamp(paragraph.start_seconds)
              const bookmarked = paragraphBookmarkIds.has(paragraph.id)
              const noteCount = passageNoteCounts.get(paragraph.id) ?? 0
              const reference = [citationCourse, offering.label, session.title, timestamp].filter(Boolean).join(' · ')
              const passagePath = `${publicReturnPath}#paragraph-${paragraph.id}`
              return <div key={paragraph.id} id={`paragraph-${paragraph.id}`} data-transcript-paragraph className="transcript-paragraph-v12">
                {showHeading ? <h3>{section?.title}</h3> : null}
                <div className="transcript-copy">{timestamp ? <span className="transcript-timestamp">{timestamp}</span> : null}{paragraph.speaker ? <strong>{paragraph.speaker}: </strong> : null}<span style={{ whiteSpace: 'pre-wrap' }}>{paragraph.body}</span></div>
                <PassageStudyTools paragraphId={paragraph.id} sessionId={session.id} returnPath={returnPath} bookmarked={userId ? bookmarked : false} canSaveBookmarks={Boolean(userId && canSaveBookmarks)} canSaveNotes={Boolean(userId && canSaveNotes)} noteCount={userId ? noteCount : 0} reference={reference} passagePath={passagePath} />
                {renderTranscriptAssets(paragraph)}
              </div>
            })}
          </article> : transcriptAssets.length > 0 ? <div className="transcript-v12-card">{renderLeadingTranscriptAssets()}</div> : <p className="meta">Transcript metadata is published, but no paragraphs have been imported yet.</p>}
        </> : <><div className="eyebrow">Reference Transcript</div><p className="meta">Reference transcript has not been uploaded for this session yet.</p></>}
      </section>

      <section className="section"><Link className="button" href={`/courses/${courseSlug}/${offeringSlug}`}>← Back to {offering.label}</Link></section>
    </main>
  )
}
