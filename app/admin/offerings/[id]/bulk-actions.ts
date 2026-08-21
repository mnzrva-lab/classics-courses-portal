'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const TRANSCRIPT_DISCLAIMER = 'This transcript was created by a student with AI and should be used for reference only. Please check them against the video and audio for accuracy of content.'
const TRANSCRIPT_ASSETS_BUCKET = 'transcript-assets'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return supabase
}

function timestampSeconds(value: string) {
  const match = value.match(/^\s*\[?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]?\s*/)
  if (!match) return { seconds: null as number | null, text: value }
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  if (minutes > 59 || seconds > 59) return { seconds: null as number | null, text: value }
  return {
    seconds: hours * 3600 + minutes * 60 + seconds,
    text: value.slice(match[0].length).trim(),
  }
}

function slugify(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

function splitSpeaker(body: string) {
  const match = body.match(/^([^:\n]{1,60}):\s+/)
  if (!match) return { speaker: null as string | null, body }

  const candidate = match[1].trim()
  const knownLabel = /^(?:Audience(?: Member)?|Speaker\s+\d+)$/i.test(candidate)
  const hostLabel = /^Host(?:,\s*[A-Z][A-Za-z'’.-]*(?:\s+[A-Z][A-Za-z'’.-]*){0,3})?$/u.test(candidate)
  const properName = /^(?:[A-Z][A-Za-z'’.-]*)(?:\s+[A-Z][A-Za-z'’.-]*){0,3}$/u.test(candidate)

  if (!knownLabel && !hostLabel && !properName) return { speaker: null as string | null, body }
  return { speaker: candidate, body: body.slice(match[0].length).trim() }
}

function parseTranscript(rawText: string, transcriptId: string, sessionId: string) {
  const blocks = rawText
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean)

  const sections: Array<{ id: string; transcript_id: string; slug: string; title: string; start_seconds: number | null; sort_order: number }> = []
  const paragraphs: Array<{ transcript_id: string; section_id: string | null; speaker: string | null; body: string; start_seconds: number | null; sort_order: number }> = []
  const assets: Array<{ transcript_id: string; after_paragraph_sort_order: number; asset_type: 'image'; storage_bucket: string; storage_path: string; mime_type: string | null; alt_text: string | null; caption: string | null; sort_order: number }> = []
  let currentSectionId: string | null = null
  let sectionOrder = 0
  let paragraphOrder = 0
  let assetOrder = 0

  for (const block of blocks) {
    const imageMatch = block.match(/^\[\[TRANSCRIPT_IMAGE\|([^|\]]+)\|([^\]]*)\]\]$/)
    if (imageMatch) {
      const storagePath = imageMatch[1].trim()
      if (!storagePath.startsWith(`transcripts/${sessionId}/`) || storagePath.includes('..')) {
        throw new Error('Transcript image upload path is invalid.')
      }
      assets.push({
        transcript_id: transcriptId,
        after_paragraph_sort_order: paragraphOrder - 1,
        asset_type: 'image',
        storage_bucket: TRANSCRIPT_ASSETS_BUCKET,
        storage_path: storagePath,
        mime_type: imageMatch[2].trim() || null,
        alt_text: null,
        caption: null,
        sort_order: assetOrder++,
      })
      continue
    }

    const headingMatch = block.match(/^###\s+([\s\S]+)$/)
    if (headingMatch) {
      const parsed = timestampSeconds(headingMatch[1].trim())
      const title = parsed.text || `Section ${sectionOrder + 1}`
      const id = randomUUID()
      currentSectionId = id
      sections.push({
        id,
        transcript_id: transcriptId,
        slug: `${slugify(title, 'section')}-${sectionOrder + 1}`,
        title,
        start_seconds: parsed.seconds,
        sort_order: sectionOrder++,
      })
      continue
    }

    const parsed = timestampSeconds(block)
    const split = splitSpeaker(parsed.text)
    if (!split.body) continue
    paragraphs.push({
      transcript_id: transcriptId,
      section_id: currentSectionId,
      speaker: split.speaker,
      body: split.body,
      start_seconds: parsed.seconds,
      sort_order: paragraphOrder++,
    })
  }

  return { sections, paragraphs, assets }
}

export async function importTranscriptDraft(
  offeringId: string,
  sessionId: string,
  sourceFileName: string,
  rawText: string,
) {
  const supabase = await requireAdmin()

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, offering_id')
    .eq('id', sessionId)
    .eq('offering_id', offeringId)
    .maybeSingle()

  if (sessionError) throw new Error(sessionError.message)
  if (!session) throw new Error('The selected session does not belong to this Course Offering.')

  const { data: existing, error: existingError } = await supabase
    .from('transcripts')
    .select('id, status')
    .eq('session_id', sessionId)
    .eq('language_code', 'en')
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing) {
    return { ok: false, skipped: true, message: `Skipped because this session already has a ${existing.status} transcript.` }
  }

  const transcriptId = randomUUID()
  const { sections, paragraphs, assets } = parseTranscript(rawText, transcriptId, sessionId)
  if (paragraphs.length === 0) throw new Error('No transcript paragraphs were found in this file.')

  const paragraphPayload = paragraphs.map((paragraph) => ({
    id: randomUUID(),
    section_id: paragraph.section_id,
    speaker: paragraph.speaker,
    body: paragraph.body,
    start_seconds: paragraph.start_seconds,
    sort_order: paragraph.sort_order,
  }))
  const paragraphIdBySortOrder = new Map(paragraphPayload.map((paragraph) => [paragraph.sort_order, paragraph.id]))

  const sectionPayload = sections.map((section) => ({
    id: section.id,
    slug: section.slug,
    title: section.title,
    start_seconds: section.start_seconds,
    sort_order: section.sort_order,
  }))

  const assetPayload = assets.map((asset) => ({
    id: null,
    after_paragraph_sort_order: asset.after_paragraph_sort_order,
    after_paragraph_id: asset.after_paragraph_sort_order >= 0
      ? paragraphIdBySortOrder.get(asset.after_paragraph_sort_order) ?? null
      : null,
    storage_bucket: asset.storage_bucket,
    storage_path: asset.storage_path,
    mime_type: asset.mime_type,
    alt_text: asset.alt_text,
    caption: asset.caption,
    sort_order: asset.sort_order,
  }))

  const { error: saveError } = await supabase.rpc('save_transcript_content', {
    p_transcript_id: transcriptId,
    p_session_id: sessionId,
    p_language_code: 'en',
    p_title: 'Reference Transcript',
    p_disclaimer: TRANSCRIPT_DISCLAIMER,
    p_source_file_name: sourceFileName,
    p_status: 'draft',
    p_sections: sectionPayload,
    p_paragraphs: paragraphPayload,
    p_assets: assetPayload,
  })

  if (saveError) throw new Error(saveError.message)

  revalidatePath('/admin')
  revalidatePath(`/admin/offerings/${offeringId}`)
  revalidatePath('/', 'layout')

  return {
    ok: true,
    skipped: false,
    message: `Imported as Draft: ${paragraphs.length} paragraphs${assets.length ? `, ${assets.length} image${assets.length === 1 ? '' : 's'}` : ''}.`,
  }
}
