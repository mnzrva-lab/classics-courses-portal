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

type CourseRelation = { slug: string; title: string; canonical_number: number | null }
type TeacherLink = { teachers: { full_name: string } | null }
type StatusRow = { status: string }
type TranscriptRow = { id: string; status: string; source_file_name: string | null }
type MaterialRow = { status: string; material_type: string }

function savedMessage(value: string | undefined) {
  const messages: Record<string, string> = {
    'session-published': 'Session published.',
    'session-draft': 'Session returned to Draft.',
    'notes-published': 'Study Notes published.',
    'notes-draft': 'Study Notes returned to Draft.',
    'transcript-published': 'Reference Transcript published.',
    'transcript-draft': 'Reference Transcript returned to Draft.',
    'materials-published': 'Draft class materials published.',
    'materials-draft': 'Published class materials returned to Draft.',
    'content-published': 'Existing Draft Study Notes, transcript content and class materials were published.',
  }
  return value ? messages[value] ?? null : null
}

function statePill(label: string, status: string, extra?: string) {
  const normalized = status === 'published' ? 'Published' : status === 'draft' ? 'Draft' : status === 'missing' ? 'Missing' : status
  return <span className="pill">{label}: {normalized}{extra ? ` · ${extra}` : ''}</span>
}

export default async function OfferingReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params
  const { saved } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>

  const [{ data: offering }, { data: sessions }] = await Promise.all([
    supabase.from('course_offerings').select('id, slug, label, status, courses(slug, title, canonical_number)').eq('id', id).single(),
    supabase.from('sessions').select(`
      id, slug, code, title, session_type, session_date, status, recording_url, audio_url,
      session_teachers(teachers(full_name)), study_notes(status), transcripts(id, status, source_file_name), materials(status, material_type)
    `).eq('offering_id', id).order('sort_order'),
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
    <main className="container page admin-review-page">
      <div className="eyebrow">Admin · Content review</div>
      <h1>{course.canonical_number ? `Course ${course.canonical_number} · ` : ''}{course.title}</h1>
      <p className="lead">Scan the whole Course Offering quickly. Open publishing controls only for the session you need.</p>

      {notice ? <div className="card completed" style={{ marginTop: 16, padding: '12px 14px' }}>{notice}</div> : null}

      <section className="admin-review-stats" aria-label="Content summary">
        <div className="admin-review-stat"><span>Sessions</span><strong>{publishedSessions}/{sessionRows.length}</strong><span>published</span></div>
        <div className="admin-review-stat"><span>Recordings / audio</span><strong>{recordings}/{sessionRows.length}</strong><span>available</span></div>
        <div className="admin-review-stat"><span>Study Notes</span><strong>{notesPublished}</strong><span>published · {notesDraft} Draft</span></div>
        <div className="admin-review-stat"><span>Transcripts</span><strong>{transcriptPublished}</strong><span>published · {transcriptDraft} Draft</span></div>
      </section>

      <div className="note" style={{ marginTop: 12 }}>
        <strong>Publishing safety</strong>
        <div className="meta">Draft preview is safe. Publishing changes shared content visibility. Session visibility remains separate from Study Notes, transcript and material visibility.</div>
      </div>

      <section className="section" style={{ marginTop: 28 }}>
        <div className="section-head">
          <div><div className="eyebrow">{offering.label} · {offering.status}</div><h2>Session review</h2></div>
          <div className="actions" style={{ marginTop: 0 }}>
            <Link className="button" href={`/admin/offerings/${offering.id}`}>Manage Course Offering</Link>
            <Link className="button" href={`/courses/${course.slug}/${offering.slug}`}>Student course page</Link>
          </div>
        </div>

        <div className="admin-review-list">
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
            const transcriptExtra = transcript ? `${paragraphCounts.get(transcript.id) ?? 0} paragraphs${imageCounts.get(transcript.id) ? ` · ${imageCounts.get(transcript.id)} images` : ''}` : undefined

            return (
              <article className="admin-review-row" key={session.id}>
                <div className="admin-review-row-head">
                  <div>
                    <div className="eyebrow">{session.code || session.session_type}</div>
                    <h3>{session.title}</h3>
                    <div className="meta">{session.session_date ?? 'No date'} · {teachers.join(', ') || 'Teacher missing'}</div>
                    <div className="admin-review-badges">
                      {statePill('Session', session.status)}
                      {statePill('Recording', session.recording_url ? 'published' : session.audio_url ? 'published' : 'missing', session.audio_url && !session.recording_url ? 'audio' : undefined)}
                      {statePill('Notes', notes?.status ?? 'missing')}
                      {statePill('Transcript', transcript?.status ?? 'missing', transcriptExtra)}
                      {statePill('Materials', publishedMaterials ? 'published' : draftMaterials ? 'draft' : 'missing', materials.length ? `${materials.length}` : undefined)}
                    </div>
                  </div>
                  <div className="admin-review-row-actions">
                    <Link className="button" href={`/admin/sessions/${session.id}`}>Edit</Link>
                    <Link className="button sage" href={previewPath}>Preview</Link>
                    {session.status === 'published' ? <Link className="button" href={studentPath}>Student view</Link> : null}
                  </div>
                </div>

                <details className="admin-review-controls">
                  <summary>Publishing controls</summary>
                  <div className="admin-review-controls-grid">
                    {session.status === 'draft' ? (
                      <form action={setSessionVisibility.bind(null, offering.id, session.id, 'published')}><ConfirmSubmitButton className="button red" confirmMessage={`Publish ${session.code || session.title} for students?`}>Publish session</ConfirmSubmitButton></form>
                    ) : session.status === 'published' ? (
                      <form action={setSessionVisibility.bind(null, offering.id, session.id, 'draft')}><ConfirmSubmitButton confirmMessage={`Return ${session.code || session.title} to Draft?`}>Session → Draft</ConfirmSubmitButton></form>
                    ) : null}

                    {notes?.status === 'draft' ? (
                      <form action={setStudyNotesVisibility.bind(null, offering.id, session.id, 'published')}><ConfirmSubmitButton className="button red" confirmMessage={`Publish Study Notes for ${session.code || session.title}?`}>Publish Notes</ConfirmSubmitButton></form>
                    ) : notes?.status === 'published' ? (
                      <form action={setStudyNotesVisibility.bind(null, offering.id, session.id, 'draft')}><ConfirmSubmitButton confirmMessage={`Return Study Notes for ${session.code || session.title} to Draft?`}>Notes → Draft</ConfirmSubmitButton></form>
                    ) : null}

                    {transcript?.status === 'draft' ? (
                      <form action={setTranscriptVisibility.bind(null, offering.id, session.id, 'published')}><ConfirmSubmitButton className="button red" confirmMessage={`Publish the Reference Transcript for ${session.code || session.title}?`}>Publish Transcript</ConfirmSubmitButton></form>
                    ) : transcript?.status === 'published' ? (
                      <form action={setTranscriptVisibility.bind(null, offering.id, session.id, 'draft')}><ConfirmSubmitButton confirmMessage={`Return the transcript for ${session.code || session.title} to Draft?`}>Transcript → Draft</ConfirmSubmitButton></form>
                    ) : null}

                    {draftMaterials > 0 ? (
                      <form action={setMaterialsVisibility.bind(null, offering.id, session.id, 'published')}><ConfirmSubmitButton className="button red" confirmMessage={`Publish ${draftMaterials} Draft material${draftMaterials === 1 ? '' : 's'}?`}>Publish Materials</ConfirmSubmitButton></form>
                    ) : null}
                    {publishedMaterials > 0 ? (
                      <form action={setMaterialsVisibility.bind(null, offering.id, session.id, 'draft')}><ConfirmSubmitButton confirmMessage={`Return ${publishedMaterials} material${publishedMaterials === 1 ? '' : 's'} to Draft?`}>Materials → Draft</ConfirmSubmitButton></form>
                    ) : null}
                    {hasDraftContent ? (
                      <form action={publishDraftContent.bind(null, offering.id, session.id)}><ConfirmSubmitButton className="button sage" confirmMessage={`Publish all existing Draft content for ${session.code || session.title}? Session visibility will not change.`}>Publish all Draft content</ConfirmSubmitButton></form>
                    ) : null}
                    {transcript ? <Link className="button" href={`/admin/sessions/${session.id}/revisions`}>Transcript history</Link> : null}
                  </div>
                </details>
              </article>
            )
          })}
        </div>
      </section>

      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
