import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ConfirmSubmitButton from './confirm-submit-button'
import {
  publishDraftContent,
  setMaterialsVisibility,
  setSessionVisibility,
  setStudyNotesVisibility,
  setTranscriptVisibility,
} from './actions'

export const dynamic = 'force-dynamic'

type CourseRelation = {
  slug: string
  title: string
  canonical_number: number | null
}

type TeacherLink = {
  teachers: { full_name: string } | null
}

type StatusRow = { status: string }
type TranscriptRow = { id: string; status: string; source_file_name: string | null }
type MaterialRow = { status: string; material_type: string }

function statusPill(status: string) {
  const label = status === 'published' ? 'Published' : status === 'draft' ? 'Draft' : status === 'archived' ? 'Archived' : status
  return <span className="pill">{label}</span>
}

function savedMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    'session-published': 'Session published. Students can now open the class page.',
    'session-draft': 'Session returned to Draft.',
    'notes-published': 'Study Notes published.',
    'notes-draft': 'Study Notes returned to Draft.',
    'transcript-published': 'Reference Transcript published.',
    'transcript-draft': 'Reference Transcript returned to Draft.',
    'materials-published': 'Draft class materials published.',
    'materials-draft': 'Published class materials returned to Draft.',
    'content-published': 'All Draft Study Notes, transcript content, and class materials for this session were published.',
  }
  return value ? messages[value] ?? null : null
}

export default async function OfferingReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  const { id } = await params
  const { saved } = await searchParams
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

  const [{ data: offering }, { data: sessions }] = await Promise.all([
    supabase
      .from('course_offerings')
      .select('id, slug, label, status, courses(slug, title, canonical_number)')
      .eq('id', id)
      .single(),
    supabase
      .from('sessions')
      .select(`
        id, slug, code, title, session_type, session_date, status, recording_url, audio_url,
        session_teachers(teachers(full_name)),
        study_notes(status),
        transcripts(id, status, source_file_name),
        materials(status, material_type)
      `)
      .eq('offering_id', id)
      .order('sort_order'),
  ])

  if (!offering) notFound()
  const course = offering.courses as unknown as CourseRelation
  const sessionRows = sessions ?? []
  const transcriptIds = sessionRows.flatMap((session: any) => ((session.transcripts ?? []) as TranscriptRow[]).map((row) => row.id))

  const paragraphCounts = new Map<string, number>()
  const imageCounts = new Map<string, number>()
  if (transcriptIds.length) {
    const [{ data: paragraphs }, { data: assets }] = await Promise.all([
      supabase.from('transcript_paragraphs').select('transcript_id').in('transcript_id', transcriptIds).eq('is_active', true),
      supabase.from('transcript_assets').select('transcript_id').in('transcript_id', transcriptIds),
    ])

    for (const row of paragraphs ?? []) paragraphCounts.set(row.transcript_id, (paragraphCounts.get(row.transcript_id) ?? 0) + 1)
    for (const row of assets ?? []) imageCounts.set(row.transcript_id, (imageCounts.get(row.transcript_id) ?? 0) + 1)
  }

  const transcriptPublished = sessionRows.filter((session: any) => ((session.transcripts ?? []) as TranscriptRow[])[0]?.status === 'published').length
  const transcriptDraft = sessionRows.filter((session: any) => ((session.transcripts ?? []) as TranscriptRow[])[0]?.status === 'draft').length
  const notesPublished = sessionRows.filter((session: any) => ((session.study_notes ?? []) as StatusRow[])[0]?.status === 'published').length
  const notesDraft = sessionRows.filter((session: any) => ((session.study_notes ?? []) as StatusRow[])[0]?.status === 'draft').length
  const recordings = sessionRows.filter((session: any) => Boolean(session.recording_url || session.audio_url)).length
  const publishedSessions = sessionRows.filter((session: any) => session.status === 'published').length
  const notice = savedMessage(saved)

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Content review</div>
      <h1>{course.canonical_number ? `Course ${course.canonical_number} · ` : ''}{course.title}</h1>
      <p className="lead">Review Draft content here, preview it as a student, and publish only the pieces that are ready.</p>

      {notice ? <div className="card completed" style={{ marginTop: 20 }}>{notice}</div> : null}

      <section className="grid section">
        <div className="card sage">
          <div className="meta">Sessions</div>
          <div className="stat">{publishedSessions} / {sessionRows.length}</div>
          <div className="meta">published for students</div>
        </div>
        <div className="card">
          <div className="meta">Reference Transcripts</div>
          <div className="stat">{transcriptPublished} published</div>
          <div className="meta">{transcriptDraft} Draft · {sessionRows.length - transcriptPublished - transcriptDraft} missing</div>
        </div>
        <div className="card">
          <div className="meta">Study Notes</div>
          <div className="stat">{notesPublished} published</div>
          <div className="meta">{notesDraft} Draft · {sessionRows.length - notesPublished - notesDraft} missing</div>
        </div>
        <div className="card">
          <div className="meta">Recordings / audio</div>
          <div className="stat">{recordings} / {sessionRows.length}</div>
          <div className="meta">at least one recording or audio source added</div>
        </div>
      </section>

      <section className="section card sage">
        <div className="eyebrow">Publishing safety</div>
        <h2 style={{ fontSize: 32 }}>Preview is safe. Publish changes visibility.</h2>
        <p className="meta">This staging site uses the shared content database. Publishing here changes the content status itself, so a confirmation is required before every publishing action. Use Draft previews freely; publish only when the content is genuinely ready for students.</p>
      </section>

      <section className="section card">
        <div className="eyebrow">Publishing model</div>
        <h2 style={{ fontSize: 32 }}>Session visibility and content visibility are separate</h2>
        <p className="meta">Publishing a transcript, Study Notes, or class material does not force the whole session live. A Draft session remains hidden from students until you publish the session itself.</p>
      </section>

      <section className="section card">
        <div className="eyebrow">Course Offering</div>
        <h2 style={{ fontSize: 32 }}>{offering.label}</h2>
        <div className="actions">
          {statusPill(offering.status)}
          <Link className="button" href={`/admin/offerings/${offering.id}`}>Manage Course Offering</Link>
          <Link className="button" href={`/courses/${course.slug}/${offering.slug}`}>Open student course page</Link>
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">Session review</div>
        <h2 style={{ fontSize: 32 }}>Review → preview → publish</h2>

        {sessionRows.map((session: any) => {
          const transcript = ((session.transcripts ?? []) as TranscriptRow[])[0]
          const notes = ((session.study_notes ?? []) as StatusRow[])[0]
          const materials = (session.materials ?? []) as MaterialRow[]
          const publishedMaterials = materials.filter((item) => item.status === 'published').length
          const draftMaterials = materials.filter((item) => item.status === 'draft').length
          const teachers = ((session.session_teachers ?? []) as TeacherLink[]).map((item) => item.teachers?.full_name).filter(Boolean)
          const previewPath = `/courses/${course.slug}/${offering.slug}/${session.slug}?contentPreview=1`
          const studentPath = `/courses/${course.slug}/${offering.slug}/${session.slug}`
          const hasDraftContent = notes?.status === 'draft' || transcript?.status === 'draft' || draftMaterials > 0

          return (
            <div className="card" key={session.id} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div className="eyebrow">{session.code || session.session_type}</div>
                  <h3 style={{ fontSize: 26 }}>{session.title}</h3>
                  <div className="meta">{session.session_date ?? 'No date'} · {teachers.join(', ') || 'Teacher missing'}</div>
                </div>
                <div className="actions" style={{ marginTop: 0 }}>
                  {statusPill(session.status)}
                  <Link className="button" href={`/admin/sessions/${session.id}`}>Edit</Link>
                  {session.status === 'published' ? <Link className="button sage" href={previewPath}>Preview Draft content</Link> : null}
                  {session.status === 'published' ? <Link className="button" href={studentPath}>Student view</Link> : null}
                </div>
              </div>

              <div className="grid two" style={{ marginTop: 22 }}>
                <div className="note">
                  <strong>Session visibility</strong>
                  <div className="meta" style={{ marginTop: 4 }}>{session.status === 'published' ? 'Students can open this class page.' : 'This class page is hidden from students.'}</div>
                  <div className="actions">
                    {session.status === 'draft' ? (
                      <form action={setSessionVisibility.bind(null, offering.id, session.id, 'published')}>
                        <ConfirmSubmitButton className="button red" confirmMessage={`Publish ${session.code ? `${session.code} · ` : ''}${session.title} for students?`}>Publish session</ConfirmSubmitButton>
                      </form>
                    ) : session.status === 'published' ? (
                      <form action={setSessionVisibility.bind(null, offering.id, session.id, 'draft')}>
                        <ConfirmSubmitButton confirmMessage={`Return ${session.code ? `${session.code} · ` : ''}${session.title} to Draft? Students will no longer be able to open it.`}>Return session to Draft</ConfirmSubmitButton>
                      </form>
                    ) : <span className="meta">Archived sessions can be changed in the session editor.</span>}
                  </div>
                </div>

                <div className="note">
                  <strong>Recording</strong>
                  <div className="meta" style={{ marginTop: 4 }}>{session.recording_url ? 'Recording added' : session.audio_url ? 'Audio added' : 'Missing'}</div>
                  <div className="actions"><Link className="button" href={`/admin/sessions/${session.id}`}>Edit recording</Link></div>
                </div>

                <div className="note">
                  <strong>Study Notes</strong>
                  <div className="meta" style={{ marginTop: 4 }}>{notes?.status ?? 'Missing'}</div>
                  <div className="actions">
                    {notes?.status === 'draft' ? (
                      <form action={setStudyNotesVisibility.bind(null, offering.id, session.id, 'published')}>
                        <ConfirmSubmitButton className="button red" confirmMessage={`Publish Study Notes for ${session.code || session.title}?`}>Publish Study Notes</ConfirmSubmitButton>
                      </form>
                    ) : notes?.status === 'published' ? (
                      <form action={setStudyNotesVisibility.bind(null, offering.id, session.id, 'draft')}>
                        <ConfirmSubmitButton confirmMessage={`Return the Study Notes for ${session.code || session.title} to Draft?`}>Return Notes to Draft</ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </div>

                <div className="note">
                  <strong>Reference Transcript</strong>
                  <div className="meta" style={{ marginTop: 4 }}>
                    {transcript
                      ? `${transcript.status} · ${paragraphCounts.get(transcript.id) ?? 0} paragraphs · ${imageCounts.get(transcript.id) ?? 0} images`
                      : 'Missing'}
                  </div>
                  {transcript?.source_file_name ? <div className="meta">Source: {transcript.source_file_name}</div> : null}
                  <div className="actions">
                    {transcript?.status === 'draft' ? (
                      <form action={setTranscriptVisibility.bind(null, offering.id, session.id, 'published')}>
                        <ConfirmSubmitButton className="button red" confirmMessage={`Publish the Reference Transcript for ${session.code || session.title}?`}>Publish Transcript</ConfirmSubmitButton>
                      </form>
                    ) : transcript?.status === 'published' ? (
                      <form action={setTranscriptVisibility.bind(null, offering.id, session.id, 'draft')}>
                        <ConfirmSubmitButton confirmMessage={`Return the Reference Transcript for ${session.code || session.title} to Draft?`}>Return Transcript to Draft</ConfirmSubmitButton>
                      </form>
                    ) : null}
                    {transcript ? <Link className="button" href={`/admin/sessions/${session.id}/revisions`}>Revision history</Link> : null}
                  </div>
                </div>

                <div className="note">
                  <strong>Class materials</strong>
                  <div className="meta" style={{ marginTop: 4 }}>{publishedMaterials} published · {draftMaterials} Draft · {materials.length} total</div>
                  <div className="actions">
                    {draftMaterials > 0 ? (
                      <form action={setMaterialsVisibility.bind(null, offering.id, session.id, 'published')}>
                        <ConfirmSubmitButton className="button red" confirmMessage={`Publish all ${draftMaterials} Draft class material${draftMaterials === 1 ? '' : 's'} for ${session.code || session.title}?`}>Publish Draft materials</ConfirmSubmitButton>
                      </form>
                    ) : null}
                    {publishedMaterials > 0 ? (
                      <form action={setMaterialsVisibility.bind(null, offering.id, session.id, 'draft')}>
                        <ConfirmSubmitButton confirmMessage={`Return all ${publishedMaterials} published class material${publishedMaterials === 1 ? '' : 's'} for ${session.code || session.title} to Draft?`}>Return materials to Draft</ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </div>

                <div className="note">
                  <strong>Quick publish</strong>
                  <div className="meta" style={{ marginTop: 4 }}>Publishes only existing Draft Study Notes, Reference Transcript, and class materials. It does not change session visibility.</div>
                  <div className="actions">
                    {hasDraftContent ? (
                      <form action={publishDraftContent.bind(null, offering.id, session.id)}>
                        <ConfirmSubmitButton className="button sage" confirmMessage={`Publish every existing Draft content item for ${session.code || session.title}? The session visibility itself will not change.`}>Publish all Draft content</ConfirmSubmitButton>
                      </form>
                    ) : <span className="meta">No Draft content waiting to publish.</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </section>

      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
