import { createClient } from '@/lib/supabase/server'
import { restoreTranscriptRevision } from './revision-actions'

export default async function TranscriptRevisionHistory({
  transcriptId,
  sessionId,
}: {
  transcriptId: string
  sessionId: string
}) {
  const supabase = await createClient()
  const { data: revisions } = await supabase
    .from('transcript_revisions')
    .select('id, revision_number, created_at')
    .eq('transcript_id', transcriptId)
    .order('revision_number', { ascending: false })
    .limit(8)

  if (!revisions?.length) return null

  return (
    <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
      <div className="eyebrow">Revision history</div>
      <p className="meta">A restore always comes back as Draft for review, and the current version is snapshotted first so the restore itself can be undone later.</p>
      {revisions.map((revision) => (
        <div key={revision.id} style={{ padding: '12px 0', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <strong>Saved version {revision.revision_number}</strong>
            <div className="meta">{new Date(revision.created_at).toLocaleString()}</div>
          </div>
          <form action={restoreTranscriptRevision.bind(null, sessionId, revision.id)}>
            <button className="button" type="submit">Restore as Draft</button>
          </form>
        </div>
      ))}
    </div>
  )
}
