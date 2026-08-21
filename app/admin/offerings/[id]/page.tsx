import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSession, updateOffering } from './actions'
import { addOfferingMaterial, deleteOfferingMaterial, updateOfferingMaterial } from './material-actions'
import { assignSessionGroup, createContentGroup, updateContentGroup } from './structure-actions'
import BulkTranscriptImport from './bulk-transcript-import'
import BulkStudyNotesImport from './bulk-study-notes-import'
import OfferingUploadMaterialForm from './upload-material-form'

export const dynamic = 'force-dynamic'

type CourseRelation = {
  id: string
  slug: string
  title: string
  canonical_number: number | null
  kind: string
}

type Teacher = {
  id: string
  full_name: string
  active: boolean
}

type TranscriptRelation = {
  status: string
}

type StudyNotesRelation = {
  status: string
}

type ContentGroup = {
  id: string
  kind: string
  slug: string
  label: string
  title: string | null
  starts_on: string | null
  ends_on: string | null
  status: string
  sort_order: number
}

const materialTypes = [
  ['reading', 'Reading'],
  ['slides', 'Slides'],
  ['audio', 'Audio'],
  ['video', 'Video'],
  ['document', 'Document'],
  ['link', 'Link'],
  ['other', 'Other'],
]

function groupTypeLabel(kind: string) {
  if (kind === 'term') return 'Term'
  if (kind === 'season') return 'Season'
  if (kind === 'part') return 'Part'
  if (kind === 'module') return 'Module'
  return 'Section'
}

function materialLabel(kind: string) {
  return materialTypes.find(([value]) => value === kind)?.[1] ?? 'Resource'
}

function uploadedFileName(path: string | null) {
  if (!path) return null
  const value = path.split('/').pop() ?? path
  return value.replace(/^[0-9a-f-]{36}-/i, '')
}

export default async function AdminOfferingPage({
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
  if (!userId) {
    return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') {
    return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>
  }

  const [
    { data: offering },
    { data: teacherRows },
    { data: sessionRows },
    { data: groupRows },
    { data: materialRows },
  ] = await Promise.all([
    supabase
      .from('course_offerings')
      .select('id, slug, label, location, year, language_codes, artwork_url, description, telegram_url, starts_on, ends_on, status, courses(id, slug, title, canonical_number, kind)')
      .eq('id', id)
      .single(),
    supabase.from('teachers').select('id, full_name, active').eq('active', true).order('full_name'),
    supabase.from('sessions').select('id, code, title, session_type, status, session_date, source_timezone, sort_order, group_id, transcripts(status), study_notes(status)').eq('offering_id', id).order('sort_order'),
    supabase.from('content_groups').select('id, kind, slug, label, title, starts_on, ends_on, status, sort_order').eq('offering_id', id).order('sort_order'),
    supabase
      .from('materials')
      .select('id, material_type, title, url, mime_type, storage_bucket, storage_path, status, sort_order')
      .eq('offering_id', id)
      .is('session_id', null)
      .order('sort_order'),
  ])

  if (!offering) notFound()
  const course = offering.courses as unknown as CourseRelation
  const teachers = (teacherRows ?? []) as Teacher[]
  const sessions = sessionRows ?? []
  const contentGroups = (groupRows ?? []) as ContentGroup[]
  const offeringMaterials = await Promise.all((materialRows ?? []).map(async (material: any) => {
    if (material.storage_bucket && material.storage_path) {
      const { data } = await supabase.storage.from(material.storage_bucket).createSignedUrl(material.storage_path, 60 * 60)
      return { ...material, resolved_url: data?.signedUrl ?? null }
    }
    return { ...material, resolved_url: material.url ?? null }
  }))
  const groupMap = new Map(contentGroups.map((group) => [group.id, group]))
  const supportsStructure = course.kind !== 'classics' || contentGroups.length > 0
  const defaultGroupKind = course.kind === 'living_lam_rim' ? 'term' : course.kind === 'book' ? 'part' : 'module'
  const defaultTimezone = sessions.find((session) => session.source_timezone)?.source_timezone ?? 'Asia/Taipei'
  const bulkTranscriptSessions = sessions.map((session) => {
    const transcripts = (session.transcripts ?? []) as TranscriptRelation[]
    return {
      id: session.id,
      code: session.code,
      title: session.title,
      transcriptStatus: transcripts[0]?.status ?? null,
    }
  })
  const bulkNotesSessions = sessions.map((session) => {
    const notes = (session.study_notes ?? []) as StudyNotesRelation[]
    return {
      id: session.id,
      code: session.code,
      title: session.title,
      notesStatus: notes[0]?.status ?? null,
    }
  })

  const notice = created === '1'
    ? 'Course Offering created. Add its structure and sessions below while it remains Draft.'
    : saved === 'offering'
      ? 'Course Offering saved.'
      : saved === 'structure'
        ? 'Program structure saved.'
        : saved === 'offering-material'
          ? 'Course Offering material saved.'
          : null

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Course Offering</div>
      <h1>{course.canonical_number ? `Course ${course.canonical_number} · ` : ''}{course.title}</h1>
      <p className="lead">Manage the offering itself and add teaching sessions without touching code.</p>

      {notice ? <div className="card completed" style={{ marginTop: 20 }}>{notice}</div> : null}

      <section className="section card">
        <div className="eyebrow">Course Offering</div>
        <h2 style={{ fontSize: 32 }}>{offering.label}</h2>
        <form className="form-stack" action={updateOffering.bind(null, offering.id)}>
          <div className="grid two">
            <label>Student-facing label<input className="input" name="label" defaultValue={offering.label} placeholder="Taiwan · 2026" required /></label>
            <label>Location<input className="input" name="location" defaultValue={offering.location ?? ''} placeholder="Taiwan" /></label>
            <label>Year<input className="input" name="year" type="number" min="1900" max="2200" defaultValue={offering.year ?? ''} /></label>
            <label>Languages<input className="input" name="language_codes" defaultValue={(offering.language_codes ?? []).join(', ')} placeholder="en, zh" /></label>
            <label>Starts on<input className="input" name="starts_on" type="date" defaultValue={offering.starts_on ?? ''} /></label>
            <label>Ends on<input className="input" name="ends_on" type="date" defaultValue={offering.ends_on ?? ''} /></label>
          </div>
          <label>Description<textarea className="input" name="description" rows={4} defaultValue={offering.description ?? ''} /></label>
          <label>Artwork URL<input className="input" name="artwork_url" type="url" defaultValue={offering.artwork_url ?? ''} /></label>
          <label>Telegram URL<input className="input" name="telegram_url" type="url" defaultValue={offering.telegram_url ?? ''} /></label>
          <label>Status
            <select className="input" name="status" defaultValue={offering.status}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div className="actions">
            <button className="button red" type="submit">Save Course Offering</button>
            <Link className="button sage" href={`/admin/offerings/${offering.id}/review`}>Review content</Link>
            {offering.status === 'published' ? <Link className="button" href={`/courses/${course.slug}/${offering.slug}`}>Student view</Link> : null}
          </div>
        </form>
      </section>

      <section className="section card">
        <div className="eyebrow">Course Offering materials</div>
        <h2 style={{ fontSize: 32 }}>Shared readings, slides, and resources</h2>
        <p className="meta">Use this for material that belongs to the whole Course Offering rather than one class. Upload it once and students can reach it from the Course Offering and from individual classes.</p>

        {offeringMaterials.length ? (
          <div style={{ marginTop: 24 }}>
            {offeringMaterials.map((material: any) => (
              <div key={material.id} style={{ padding: '20px 0', borderTop: '1px solid var(--line)' }}>
                <form className="form-stack" action={updateOfferingMaterial.bind(null, offering.id, material.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <div>
                      <strong>{material.title}</strong>
                      <div className="meta">{materialLabel(material.material_type)} · {material.status}{material.storage_path ? ` · uploaded file: ${uploadedFileName(material.storage_path)}` : ' · linked resource'}</div>
                    </div>
                    {material.resolved_url ? <a className="button" href={material.resolved_url} target="_blank" rel="noreferrer">Open</a> : null}
                  </div>
                  <div className="grid two">
                    <label>Title<input className="input" name="material_title" defaultValue={material.title} required /></label>
                    <label>Type
                      <select className="input" name="material_type" defaultValue={material.material_type}>
                        {materialTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label>Status
                      <select className="input" name="material_status" defaultValue={material.status}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </label>
                    <label>MIME type<input className="input" name="material_mime_type" defaultValue={material.mime_type ?? ''} placeholder="Optional" /></label>
                  </div>
                  <label>External URL
                    <input className="input" name="material_url" type="url" defaultValue={material.url ?? ''} placeholder={material.storage_path ? 'Optional for uploaded files' : 'Required for linked resources'} />
                  </label>
                  <div className="actions"><button className="button" type="submit">Save material</button></div>
                </form>
                <form action={deleteOfferingMaterial.bind(null, offering.id, material.id)} style={{ marginTop: 8 }}>
                  <button className="button" type="submit">Delete material</button>
                </form>
              </div>
            ))}
          </div>
        ) : <p className="meta" style={{ marginTop: 18 }}>No Course Offering materials yet.</p>}

        <div className="grid two" style={{ marginTop: 28 }}>
          <div className="note">
            <strong>Upload a file</strong>
            <div style={{ marginTop: 14 }}><OfferingUploadMaterialForm offeringId={offering.id} /></div>
          </div>
          <div className="note">
            <strong>Add linked resource</strong>
            <form className="form-stack" action={addOfferingMaterial.bind(null, offering.id)} style={{ marginTop: 14 }}>
              <label>Title<input className="input" name="material_title" required placeholder="Course Reading" /></label>
              <div className="grid two">
                <label>Type
                  <select className="input" name="material_type" defaultValue="reading">
                    {materialTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>Status
                  <select className="input" name="material_status" defaultValue="draft">
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </label>
              </div>
              <label>URL<input className="input" name="material_url" type="url" required /></label>
              <label>MIME type<input className="input" name="material_mime_type" placeholder="Optional" /></label>
              <button className="button sage" type="submit">Add resource</button>
            </form>
          </div>
        </div>
      </section>

      {supportsStructure ? (
        <section className="section card">
          <div className="eyebrow">Program structure</div>
          <h2 style={{ fontSize: 32 }}>{course.kind === 'living_lam_rim' ? 'Terms' : 'Parts and modules'}</h2>
          <p className="meta">Use sections to organize a long-running program before students reach individual classes. Living Lam Rim uses Term → Class. Other programs can use Part or Module.</p>

          {contentGroups.length ? (
            <div style={{ marginTop: 24 }}>
              {contentGroups.map((group) => (
                <form key={group.id} className="form-stack" action={updateContentGroup.bind(null, offering.id, group.id)} style={{ padding: '20px 0', borderTop: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <strong>{group.label}{group.title ? ` · ${group.title}` : ''}</strong>
                      <div className="meta">{groupTypeLabel(group.kind)} · {group.status} · /{group.slug}</div>
                    </div>
                  </div>
                  <div className="grid two">
                    <label>Type
                      <select className="input" name="kind" defaultValue={group.kind}>
                        <option value="term">Term</option>
                        <option value="season">Season</option>
                        <option value="part">Part</option>
                        <option value="module">Module</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label>Label<input className="input" name="label" defaultValue={group.label} required /></label>
                    <label>Title<input className="input" name="title" defaultValue={group.title ?? ''} placeholder="Optional descriptive title" /></label>
                    <label>Sort order<input className="input" name="sort_order" type="number" min="0" defaultValue={group.sort_order} /></label>
                    <label>Starts on<input className="input" name="starts_on" type="date" defaultValue={group.starts_on ?? ''} /></label>
                    <label>Ends on<input className="input" name="ends_on" type="date" defaultValue={group.ends_on ?? ''} /></label>
                  </div>
                  <label>Status
                    <select className="input" name="status" defaultValue={group.status}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                  <div className="actions"><button className="button" type="submit">Save section</button></div>
                </form>
              ))}
            </div>
          ) : <p className="meta" style={{ marginTop: 20 }}>No terms or modules yet. Create the first one below.</p>}

          <div className="note" style={{ marginTop: 24 }}>
            <strong>Create section</strong>
            <form className="form-stack" action={createContentGroup.bind(null, offering.id, course.id)} style={{ marginTop: 14 }}>
              <div className="grid two">
                <label>Type
                  <select className="input" name="kind" defaultValue={defaultGroupKind}>
                    <option value="term">Term</option>
                    <option value="season">Season</option>
                    <option value="part">Part</option>
                    <option value="module">Module</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label>Label<input className="input" name="label" placeholder={course.kind === 'living_lam_rim' ? 'Term 1' : 'Part 1'} required /></label>
                <label>Title<input className="input" name="title" placeholder="Optional descriptive title" /></label>
                <label>URL slug<input className="input" name="slug" placeholder="Optional, e.g. term-1" /></label>
                <label>Starts on<input className="input" name="starts_on" type="date" /></label>
                <label>Ends on<input className="input" name="ends_on" type="date" /></label>
              </div>
              <label>Status
                <select className="input" name="status" defaultValue="draft">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <button className="button sage" type="submit">Create section</button>
            </form>
          </div>
        </section>
      ) : null}

      <section className="section card">
        <div className="eyebrow">Sessions</div>
        <h2 style={{ fontSize: 32 }}>Existing teaching sessions</h2>
        {supportsStructure && contentGroups.length ? <p className="meta">Assign each class to its Term, Part, or Module here. The student library then uses that structure automatically.</p> : null}
        {sessions.length ? sessions.map((session) => {
          const transcripts = (session.transcripts ?? []) as TranscriptRelation[]
          const notes = (session.study_notes ?? []) as StudyNotesRelation[]
          const group = session.group_id ? groupMap.get(session.group_id) : null
          return (
            <div key={session.id} style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <strong>{session.code ? `${session.code} · ` : ''}{session.title}</strong>
                  <div className="meta">{session.session_date ?? 'No date'} · {session.session_type} · {session.status} · Study Notes: {notes[0]?.status ?? 'missing'} · Transcript: {transcripts[0]?.status ?? 'missing'}</div>
                  {group ? <div className="meta">{groupTypeLabel(group.kind)}: {group.label}{group.title ? ` · ${group.title}` : ''}</div> : supportsStructure ? <div className="meta">Not assigned to a section yet.</div> : null}
                </div>
                <div className="actions" style={{ marginTop: 0 }}>
                  <Link className="button" href={`/admin/sessions/${session.id}`}>Edit</Link>
                </div>
              </div>
              {supportsStructure && contentGroups.length ? (
                <form className="actions" action={assignSessionGroup.bind(null, offering.id, session.id)}>
                  <select className="input" name="group_id" defaultValue={session.group_id ?? ''} style={{ maxWidth: 420 }}>
                    <option value="">No section</option>
                    {contentGroups.filter((item) => item.status !== 'archived').map((item) => (
                      <option key={item.id} value={item.id}>{item.label}{item.title ? ` · ${item.title}` : ''}</option>
                    ))}
                  </select>
                  <button className="button" type="submit">Save section assignment</button>
                </form>
              ) : null}
            </div>
          )
        }) : <p className="meta">No sessions have been added yet.</p>}
      </section>

      <section className="section card">
        <div className="eyebrow">Bulk import</div>
        <h2 style={{ fontSize: 32 }}>Import Reference Transcripts</h2>
        <p className="meta">Select several DOCX, Markdown, or text transcripts for this Course Offering. The importer matches Class and Meditation numbers from each filename, preserves embedded DOCX images, and saves every new transcript as Draft for review.</p>
        <BulkTranscriptImport offeringId={offering.id} sessions={bulkTranscriptSessions} />
      </section>

      <section className="section card">
        <div className="eyebrow">Bulk import</div>
        <h2 style={{ fontSize: 32 }}>Import Study Notes</h2>
        <p className="meta">Select several Study Notes files at once. DOCX headings, emphasis, lists, links, and simple tables are converted to Markdown, Class and Meditation numbers are matched from filenames, and every new set of notes stays Draft for review. Existing Study Notes are never overwritten by bulk import.</p>
        <BulkStudyNotesImport offeringId={offering.id} sessions={bulkNotesSessions} />
      </section>

      <section className="section card">
        <div className="eyebrow">Add session</div>
        <h2 style={{ fontSize: 32 }}>Create a class, meditation, review, or Q&amp;A</h2>
        <p className="meta">New sessions can stay Draft until the details are ready. After creation, you can add Study Notes and the Reference Transcript.{supportsStructure ? ' If this program uses terms or modules, assign the new session in the Existing teaching sessions section after it is created.' : ''}</p>

        <form className="form-stack" action={createSession.bind(null, offering.id, course.id)}>
          <div className="grid two">
            <label>Type
              <select className="input" name="session_type" defaultValue="class">
                <option value="class">Class</option>
                <option value="meditation">Meditation</option>
                <option value="review">Review</option>
                <option value="qna">Q&amp;A</option>
                <option value="vows">Vows</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>Code<input className="input" name="code" placeholder="C11, M5, Q&A" /></label>
          </div>
          <label>Title<input className="input" name="title" placeholder="Class 11" required /></label>

          <div className="grid two">
            <label>Date<input className="input" type="date" name="session_date" /></label>
            <label>Source timezone<input className="input" name="source_timezone" defaultValue={defaultTimezone} placeholder="Asia/Taipei" /></label>
            <label>Start time<input className="input" type="time" name="start_time" /></label>
            <label>End time<input className="input" type="time" name="end_time" /></label>
          </div>

          <label>Recording URL<input className="input" type="url" name="recording_url" placeholder="Optional" /></label>
          <label>Audio URL<input className="input" type="url" name="audio_url" placeholder="Optional" /></label>
          <label>Zoom URL<input className="input" type="url" name="zoom_url" placeholder="Optional" /></label>

          {teachers.length ? (
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 700, marginBottom: 8 }}>Teacher</legend>
              <div className="actions">
                {teachers.map((teacher) => (
                  <label key={teacher.id} className="button" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" name="teacher_id" value={teacher.id} style={{ marginRight: 8 }} />
                    {teacher.full_name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" name="required_for_completion" defaultChecked />
            Required for course completion
          </label>

          <label>Status
            <select className="input" name="status" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <button className="button sage" type="submit">Create session</button>
        </form>
      </section>

      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
