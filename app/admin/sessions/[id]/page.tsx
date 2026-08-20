import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isoToZonedParts, isValidTimeZone } from '@/lib/timezone'
import { addMaterial, deleteMaterial, saveStudyNotes, saveTranscript, updateMaterial, updateSession } from './actions'
import TextImportField from './text-import-field'
import UploadMaterialForm from './upload-material-form'

export const dynamic = 'force-dynamic'

type CourseRelation = { slug: string; title: string }
type OfferingRelation = { slug: string; label: string }
type Teacher = { id: string; full_name: string }

type TranscriptSection = {
  id: string
  title: string
  start_seconds: number | null
  sort_order: number
}

type TranscriptParagraph = {
  section_id: string | null
  speaker: string | null
  body: string
  start_seconds: number | null
  sort_order: number
}

function formatTimestamp(seconds: number | null) {
  if (seconds == null) return ''
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return hours > 0
    ? `[${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}] `
    : `[${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}] `
}

function rebuildTranscript(sections: TranscriptSection[], paragraphs: TranscriptParagraph[]) {
  const sectionMap = new Map(sections.map((section) => [section.id, section]))
  const emitted = new Set<string>()
  const blocks: string[] = []

  for (const paragraph of paragraphs) {
    if (paragraph.section_id && !emitted.has(paragraph.section_id)) {
      const section = sectionMap.get(paragraph.section_id)
      if (section) {
        blocks.push(`### ${formatTimestamp(section.start_seconds)}${section.title}`)
        emitted.add(section.id)
      }
    }

    const speaker = paragraph.speaker ? `${paragraph.speaker}: ` : ''
    blocks.push(`${formatTimestamp(paragraph.start_seconds)}${speaker}${paragraph.body}`)
  }

  for (const section of sections) {
    if (!emitted.has(section.id)) blocks.push(`### ${formatTimestamp(section.start_seconds)}${section.title}`)
  }

  return blocks.join('\n\n')
}

const materialTypeOptions = [
  ['reading', 'Reading'],
  ['slides', 'Slides'],
  ['audio', 'Audio'],
  ['video', 'Video'],
  ['document', 'Document'],
  ['link', 'Link'],
  ['other', 'Other'],
]

function storageFileName(path: string | null) {
  if (!path) return null
  const value = path.split('/').pop() ?? path
  const firstDash = value.indexOf('-')
  return firstDash >= 0 ? value.slice(firstDash + 1) : value
}

export default async function AdminSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string; created?: string }>
}) {
  const { id } = await params
  const { saved, created } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  if (!userId) return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>

  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, code, title, session_type, session_date, starts_at, ends_at, source_timezone,
      recording_url, audio_url, zoom_url, required_for_completion, status,
      courses(slug, title), course_offerings(slug, label)
    `)
    .eq('id', id)
    .single()

  if (!session) notFound()

  const course = session.courses as unknown as CourseRelation | null
  const offering = session.course_offerings as unknown as OfferingRelation | null
  const sourceTimezone = session.source_timezone && isValidTimeZone(session.source_timezone) ? session.source_timezone : 'Asia/Taipei'
  const startParts = isoToZonedParts(session.starts_at, sourceTimezone)
  const endParts = isoToZonedParts(session.ends_at, sourceTimezone)
  const sessionDate = session.session_date ?? startParts.date

  const [{ data: studyNotes }, { data: transcript }, { data: teacherRows }, { data: teacherLinks }, { data: materialRows }] = await Promise.all([
    supabase.from('study_notes').select('title, summary, content_markdown, status').eq('session_id', id).eq('language_code', 'en').maybeSingle(),
    supabase.from('transcripts').select('id, title, source_file_name, status').eq('session_id', id).eq('language_code', 'en').maybeSingle(),
    supabase.from('teachers').select('id, full_name').eq('active', true).order('full_name'),
    supabase.from('session_teachers').select('teacher_id').eq('session_id', id),
    supabase.from('materials').select('id, material_type, title, url, mime_type, status, sort_order, storage_bucket, storage_path').eq('session_id', id).order('sort_order'),
  ])

  const teachers = (teacherRows ?? []) as Teacher[]
  const selectedTeacherIds = new Set((teacherLinks ?? []).map((link: any) => link.teacher_id))
  const materials = materialRows ?? []

  let transcriptText = ''
  if (transcript?.id) {
    const [{ data: sections }, { data: paragraphs }] = await Promise.all([
      supabase.from('transcript_sections').select('id, title, start_seconds, sort_order').eq('transcript_id', transcript.id).order('sort_order'),
      supabase.from('transcript_paragraphs').select('section_id, speaker, body, start_seconds, sort_order').eq('transcript_id', transcript.id).order('sort_order'),
    ])
    transcriptText = rebuildTranscript((sections ?? []) as TranscriptSection[], (paragraphs ?? []) as TranscriptParagraph[])
  }

  const savedMessage = created === '1'
    ? 'Session created. You can now add content and publish it when ready.'
    : saved === 'session'
      ? 'Session details saved.'
      : saved === 'notes'
        ? 'Study Notes saved.'
        : saved === 'material'
          ? 'Class materials saved.'
          : saved === 'transcript'
            ? 'Reference Transcript saved.'
            : null

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Session</div>
      <h1>{session.code ? `${session.code} · ` : ''}{session.title}</h1>
      <p className="lead">Edit the teaching, then publish the pieces that are ready for students.</p>
      {savedMessage ? <div className="card completed" style={{ marginTop: 20 }}>{savedMessage}</div> : null}

      <section className="section card">
        <div className="eyebrow">1 · Session details</div>
        <h2>Class information</h2>
        <p className="meta">Enter the date and clock time exactly as scheduled in the source timezone. The site converts it for each student automatically.</p>
        <form className="form-stack" action={updateSession.bind(null, session.id)}>
          <div className="grid two">
            <label>Code<input className="input" name="code" defaultValue={session.code ?? ''} placeholder="C1 or M1" /></label>
            <label>Type
              <select className="input" name="session_type" defaultValue={session.session_type}>
                <option value="class">Class</option>
                <option value="meditation">Meditation</option>
                <option value="review">Review</option>
                <option value="qna">Q&amp;A</option>
                <option value="vows">Vows</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <label>Title<input className="input" name="title" defaultValue={session.title} required /></label>
          <div className="grid two">
            <label>Date<input className="input" type="date" name="session_date" defaultValue={sessionDate} /></label>
            <label>Source timezone<input className="input" name="source_timezone" defaultValue={sourceTimezone} placeholder="Asia/Taipei" /></label>
          </div>
          <div className="grid two">
            <label>Start time<input className="input" type="time" name="start_time" defaultValue={startParts.time} /></label>
            <label>End time<input className="input" type="time" name="end_time" defaultValue={endParts.time} /></label>
          </div>

          {teachers.length ? (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 700, marginBottom: 8 }}>Teacher</legend>
              <div className="actions">
                {teachers.map((teacher) => (
                  <label key={teacher.id} className="button" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" name="teacher_id" value={teacher.id} defaultChecked={selectedTeacherIds.has(teacher.id)} style={{ marginRight: 8 }} />
                    {teacher.full_name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <label>Recording URL<input className="input" type="url" name="recording_url" defaultValue={session.recording_url ?? ''} placeholder="YouTube or Google Drive" /></label>
          <label>Audio URL<input className="input" type="url" name="audio_url" defaultValue={session.audio_url ?? ''} placeholder="Optional MP3 or M4A" /></label>
          <label>Zoom URL<input className="input" type="url" name="zoom_url" defaultValue={session.zoom_url ?? ''} /></label>
          <label>Status
            <select className="input" name="status" defaultValue={session.status}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" name="required_for_completion" defaultChecked={session.required_for_completion} />
            Required for course completion
          </label>
          <div className="actions"><button className="button red" type="submit">Save session</button></div>
        </form>
      </section>

      <section className="section card">
        <div className="eyebrow">2 · Study Notes</div>
        <h2>Study aid</h2>
        <p className="meta">Paste cleaned Study Notes or import a DOCX, Markdown, or text file. The standard Study Notes disclaimer is added automatically.</p>
        <form className="form-stack" action={saveStudyNotes.bind(null, session.id)}>
          <label>Title<input className="input" name="study_notes_title" defaultValue={studyNotes?.title ?? 'Study Notes'} /></label>
          <label>Short summary<textarea className="input" name="study_notes_summary" rows={3} defaultValue={studyNotes?.summary ?? ''} /></label>
          <TextImportField
            name="study_notes_content"
            label="Study Notes"
            rows={18}
            defaultValue={studyNotes?.content_markdown ?? ''}
            placeholder="Paste Study Notes in Markdown or plain text"
            help="DOCX imports as editable text in your browser. Review the content before saving or publishing."
          />
          <label>Status
            <select className="input" name="study_notes_status" defaultValue={studyNotes?.status ?? 'draft'}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div className="actions"><button className="button red" type="submit">Save Study Notes</button></div>
        </form>
      </section>

      <section className="section card">
        <div className="eyebrow">3 · Class materials</div>
        <h2>Readings, slides, and resources</h2>
        <p className="meta">Upload smaller files directly to the private teaching-materials bucket, or add a stable external link. Draft uploads stay private. Published uploads receive temporary student access links when the class page loads.</p>

        {materials.length ? (
          <div style={{ marginBottom: 28 }}>
            {materials.map((material: any) => (
              <div key={material.id} style={{ padding: '18px 0', borderTop: '1px solid var(--line)' }}>
                {material.storage_path ? <p className="meta">Uploaded file: {storageFileName(material.storage_path)} · private storage</p> : null}
                <form className="form-stack" action={updateMaterial.bind(null, session.id, material.id)}>
                  <div className="grid two">
                    <label>Type
                      <select className="input" name="material_type" defaultValue={material.material_type}>
                        {materialTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label>Status
                      <select className="input" name="material_status" defaultValue={material.status}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>
                  </div>
                  <label>Title<input className="input" name="material_title" defaultValue={material.title} required /></label>
                  <label>External resource URL<input className="input" type="url" name="material_url" defaultValue={material.url ?? ''} required={!material.storage_path} placeholder={material.storage_path ? 'Optional for uploaded files' : 'Google Drive, PDF, slides, YouTube, etc.'} /></label>
                  <label>MIME type<input className="input" name="material_mime_type" defaultValue={material.mime_type ?? ''} placeholder="Optional, e.g. application/pdf" /></label>
                  <div className="actions"><button className="button" type="submit">Save resource</button></div>
                </form>
                <form action={deleteMaterial.bind(null, session.id, material.id)} style={{ marginTop: 8 }}>
                  <button className="button" type="submit">Remove resource</button>
                </form>
              </div>
            ))}
          </div>
        ) : <p className="meta">No class materials have been added yet.</p>}

        <div className="grid two" style={{ paddingTop: 20, borderTop: '1px solid var(--line)' }}>
          <div>
            <div className="eyebrow">Upload</div>
            <h3>Upload a file</h3>
            <UploadMaterialForm sessionId={session.id} />
          </div>
          <div>
            <div className="eyebrow">External link</div>
            <h3>Add linked resource</h3>
            <form className="form-stack" action={addMaterial.bind(null, session.id)}>
              <div className="grid two">
                <label>Type
                  <select className="input" name="material_type" defaultValue="reading">
                    {materialTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>Status
                  <select className="input" name="material_status" defaultValue="draft">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              </div>
              <label>Title<input className="input" name="material_title" placeholder="Class reading" required /></label>
              <label>Resource URL<input className="input" type="url" name="material_url" placeholder="Google Drive, PDF, slides, YouTube, etc." required /></label>
              <label>MIME type<input className="input" name="material_mime_type" placeholder="Optional, e.g. application/pdf" /></label>
              <div className="actions"><button className="button sage" type="submit">Add resource link</button></div>
            </form>
          </div>
        </div>
      </section>

      <section className="section card">
        <div className="eyebrow">4 · Reference Transcript</div>
        <h2>Transcript importer</h2>
        <p className="meta">Paste a cleaned transcript or import DOCX, Markdown, or text. Use <strong>### Chapter title</strong> for chapter headings. Speaker labels such as <strong>Speaker 1:</strong>, <strong>Timothy Lowenhaupt:</strong>, and <strong>Brian Mendoza:</strong> are recognized. Optional timestamps like <strong>[12:34]</strong> or <strong>[01:12:34]</strong> are also recognized.</p>
        <form className="form-stack" action={saveTranscript.bind(null, session.id)}>
          <label>Title<input className="input" name="transcript_title" defaultValue={transcript?.title ?? 'Reference Transcript'} /></label>
          <label>Source file name<input className="input" name="transcript_source_file_name" defaultValue={transcript?.source_file_name ?? ''} placeholder="Optional, for internal reference" /></label>
          <TextImportField
            name="transcript_content"
            label="Transcript"
            rows={24}
            defaultValue={transcriptText}
            placeholder={'### Opening\n\nSpeaker 1: Transcript paragraph...'}
            help="DOCX imports as editable plain text. After importing, add or verify ### chapter headings, speaker labels, timestamps, and image anchors before publishing."
          />
          <label>Status
            <select className="input" name="transcript_status" defaultValue={transcript?.status ?? 'draft'}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          {transcript ? <p className="meta">Saving replaces the current paragraph records for this transcript. During this initial production phase, avoid replacing a published transcript after students have begun bookmarking passages.</p> : null}
          <div className="actions"><button className="button red" type="submit">Import transcript</button></div>
        </form>
      </section>

      <section className="section">
        <div className="actions">
          <Link className="button" href="/admin">Back to admin</Link>
          {course && offering ? <Link className="button" href={`/courses/${course.slug}/${offering.slug}`}>Open Course Offering</Link> : null}
        </div>
      </section>
    </main>
  )
}
