import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { restoreTranscriptRevision } from '../revision-actions'

export const dynamic = 'force-dynamic'

export default async function TranscriptRevisionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  if (!userId) return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>

  const [{ data: session }, { data: transcript }] = await Promise.all([
    supabase.from('sessions').select('id, code, title').eq('id', id).maybeSingle(),
    supabase.from('transcripts').select('id, title, status, updated_at').eq('session_id', id).eq('language_code', 'en').maybeSingle(),
  ])

  if (!session) notFound()

  const { data: revisions } = transcript?.id
    ? await supabase
      .from('transcript_revisions')
      .select('id, revision_number, created_at')
      .eq('transcript_id', transcript.id)
      .order('revision_number', { ascending: false })
      .limit(30)
    : { data: [] }

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Transcript revisions</div>
      <h1>{session.code ? `${session.code} · ` : ''}{session.title}</h1>
      <p className="lead">Previous saved versions are kept so transcript corrections do not become irreversible.</p>

      <section className="section card sage">
        <div className="eyebrow">Current transcript</div>
        {transcript ? (
          <>
            <h2>{transcript.title}</h2>
            <p className="meta">Status: {transcript.status} · Last saved {new Date(transcript.updated_at).toLocaleString()}</p>
          </>
        ) : <p className="meta">This session does not have a Reference Transcript yet.</p>}
        <div className="actions"><Link className="button" href={`/admin/sessions/${session.id}`}>Back to editor</Link></div>
      </section>

      <section className="section card">
        <div className="eyebrow">Revision history</div>
        <h2>Saved versions</h2>
        <p className="meta">Restoring a version brings it back as Draft for review. Before the restore happens, the current transcript is saved as another revision, so you can reverse the restore later.</p>

        {revisions?.length ? revisions.map((revision) => (
          <div key={revision.id} style={{ padding: '16px 0', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <strong>Saved version {revision.revision_number}</strong>
              <div className="meta">{new Date(revision.created_at).toLocaleString()}</div>
            </div>
            <form action={restoreTranscriptRevision.bind(null, session.id, revision.id)}>
              <button className="button" type="submit">Restore as Draft</button>
            </form>
          </div>
        )) : <p className="meta">No previous revisions yet. The first revision is created automatically the next time an existing transcript is saved.</p>}
      </section>
    </main>
  )
}
