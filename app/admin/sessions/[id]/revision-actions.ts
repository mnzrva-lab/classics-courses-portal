'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return supabase
}

export async function restoreTranscriptRevision(sessionId: string, revisionId: string) {
  const supabase = await requireAdmin()

  const { data: transcript, error: transcriptError } = await supabase
    .from('transcripts')
    .select('id')
    .eq('session_id', sessionId)
    .eq('language_code', 'en')
    .maybeSingle()

  if (transcriptError) throw new Error(transcriptError.message)
  if (!transcript) throw new Error('Transcript not found.')

  const { data: revision, error: revisionError } = await supabase
    .from('transcript_revisions')
    .select('snapshot')
    .eq('id', revisionId)
    .eq('transcript_id', transcript.id)
    .maybeSingle()

  if (revisionError) throw new Error(revisionError.message)
  if (!revision?.snapshot) throw new Error('Revision not found.')

  const snapshot = revision.snapshot as any
  const meta = snapshot.transcript ?? {}
  const activeParagraphs = (snapshot.paragraphs ?? []).filter((paragraph: any) => paragraph.is_active !== false)
  const activeIds = new Set(activeParagraphs.map((paragraph: any) => paragraph.id))
  const paragraphIdBySort = new Map(activeParagraphs.map((paragraph: any) => [paragraph.sort_order, paragraph.id]))

  const paragraphs = activeParagraphs.map((paragraph: any) => ({
    id: paragraph.id,
    section_id: paragraph.section_id ?? null,
    speaker: paragraph.speaker ?? null,
    body: paragraph.body,
    start_seconds: paragraph.start_seconds ?? null,
    sort_order: paragraph.sort_order,
  }))

  const sections = (snapshot.sections ?? []).map((section: any) => ({
    id: section.id,
    slug: section.slug,
    title: section.title,
    start_seconds: section.start_seconds ?? null,
    sort_order: section.sort_order,
  }))

  const assets = (snapshot.assets ?? []).map((asset: any) => {
    const stableParagraphId = asset.after_paragraph_id && activeIds.has(asset.after_paragraph_id)
      ? asset.after_paragraph_id
      : asset.after_paragraph_sort_order >= 0
        ? paragraphIdBySort.get(asset.after_paragraph_sort_order) ?? null
        : null

    return {
      id: asset.id ?? null,
      after_paragraph_sort_order: asset.after_paragraph_sort_order ?? -1,
      after_paragraph_id: stableParagraphId,
      storage_bucket: asset.storage_bucket,
      storage_path: asset.storage_path,
      mime_type: asset.mime_type ?? null,
      alt_text: asset.alt_text ?? null,
      caption: asset.caption ?? null,
      sort_order: asset.sort_order ?? 0,
    }
  })

  for (const asset of assets) {
    if (asset.storage_bucket === 'transcript-assets') {
      const expectedPrefix = `transcripts/${sessionId}/`
      if (!asset.storage_path?.startsWith(expectedPrefix) || asset.storage_path.includes('..')) {
        throw new Error('This revision contains an invalid transcript image reference.')
      }
    }
  }

  const { error: restoreError } = await supabase.rpc('save_transcript_content', {
    p_transcript_id: transcript.id,
    p_session_id: sessionId,
    p_language_code: meta.language_code ?? 'en',
    p_title: meta.title ?? 'Reference Transcript',
    p_disclaimer: meta.disclaimer ?? 'This transcript was created by a student with AI and should be used for reference only. Please check them against the video and audio for accuracy of content.',
    p_source_file_name: meta.source_file_name ?? null,
    p_status: 'draft',
    p_sections: sections,
    p_paragraphs: paragraphs,
    p_assets: assets,
  })

  if (restoreError) throw new Error(restoreError.message)

  revalidatePath('/admin')
  revalidatePath('/', 'layout')
  redirect(`/admin/sessions/${sessionId}?saved=restored`)
}
