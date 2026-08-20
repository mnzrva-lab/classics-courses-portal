'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isValidTimeZone, zonedLocalToIso } from '@/lib/timezone'

const STUDY_NOTES_DISCLAIMER = 'These study notes were created from the class with the assistance of AI and are provided as a study aid. They may simplify or omit parts of the teaching. Please refer to the recording and transcript for the complete class.'
const TRANSCRIPT_DISCLAIMER = 'This transcript was created by a student with AI and should be used for reference only. Please check them against the video and audio for accuracy of content.'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') throw new Error('Admin access required')

  return supabase
}

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function requiredText(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`${label} is required`)
  return text
}

function validStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? 'draft')
  if (!['draft', 'published', 'archived'].includes(status)) throw new Error('Invalid status')
  return status
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

function parseTranscript(rawText: string, transcriptId: string) {
  const blocks = rawText
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean)

  const sections: Array<{ id: string; transcript_id: string; slug: string; title: string; start_seconds: number | null; sort_order: number }> = []
  const paragraphs: Array<{ transcript_id: string; section_id: string | null; speaker: string | null; body: string; start_seconds: number | null; sort_order: number }> = []
  let currentSectionId: string | null = null
  let sectionOrder = 0
  let paragraphOrder = 0

  for (const block of blocks) {
    const headingMatch = block.match(/^###\s+(.+)$/s)
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
    let body = parsed.text
    let speaker: string | null = null
    const speakerMatch = body.match(/^((?:Speaker\s+\d+)|(?:Timothy Lowenhaupt)|(?:Brian Mendoza)):\s*/i)
    if (speakerMatch) {
      speaker = speakerMatch[1]
      body = body.slice(speakerMatch[0].length).trim()
    }

    if (!body) continue
    paragraphs.push({
      transcript_id: transcriptId,
      section_id: currentSectionId,
      speaker,
      body,
      start_seconds: parsed.seconds,
      sort_order: paragraphOrder++,
    })
  }

  return { sections, paragraphs }
}

export async function updateSession(sessionId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const status = validStatus(formData.get('status'))
  const sessionType = String(formData.get('session_type') ?? 'class')
  if (!['class', 'meditation', 'review', 'qna', 'vows', 'other'].includes(sessionType)) throw new Error('Invalid session type')

  const sessionDate = optionalText(formData.get('session_date'))
  const sourceTimezone = optionalText(formData.get('source_timezone')) ?? 'Asia/Taipei'
  const startTime = optionalText(formData.get('start_time'))
  const endTime = optionalText(formData.get('end_time'))

  if (!isValidTimeZone(sourceTimezone)) throw new Error('Please enter a valid timezone, such as Asia/Taipei.')
  if ((startTime || endTime) && !sessionDate) throw new Error('Choose the session date before entering a start or end time.')

  const startsAt = sessionDate && startTime ? zonedLocalToIso(sessionDate, startTime, sourceTimezone) : null
  const endsAt = sessionDate && endTime ? zonedLocalToIso(sessionDate, endTime, sourceTimezone) : null

  const { error } = await supabase
    .from('sessions')
    .update({
      code: optionalText(formData.get('code')),
      title: requiredText(formData.get('title'), 'Title'),
      session_type: sessionType,
      session_date: sessionDate,
      starts_at: startsAt,
      ends_at: endsAt,
      source_timezone: sourceTimezone,
      recording_url: optionalText(formData.get('recording_url')),
      audio_url: optionalText(formData.get('audio_url')),
      zoom_url: optionalText(formData.get('zoom_url')),
      required_for_completion: formData.get('required_for_completion') === 'on',
      status,
    })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  const teacherIds = Array.from(new Set(formData.getAll('teacher_id').map(String).filter(Boolean)))
  const { error: deleteTeacherError } = await supabase.from('session_teachers').delete().eq('session_id', sessionId)
  if (deleteTeacherError) throw new Error(deleteTeacherError.message)

  if (teacherIds.length > 0) {
    const { error: insertTeacherError } = await supabase.from('session_teachers').insert(
      teacherIds.map((teacherId, index) => ({ session_id: sessionId, teacher_id: teacherId, sort_order: index }))
    )
    if (insertTeacherError) throw new Error(insertTeacherError.message)
  }

  revalidatePath('/admin')
  revalidatePath('/', 'layout')
  redirect(`/admin/sessions/${sessionId}?saved=session`)
}

export async function saveStudyNotes(sessionId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const status = validStatus(formData.get('study_notes_status'))
  const content = requiredText(formData.get('study_notes_content'), 'Study Notes')

  const { error } = await supabase.from('study_notes').upsert({
    session_id: sessionId,
    language_code: 'en',
    title: optionalText(formData.get('study_notes_title')) ?? 'Study Notes',
    summary: optionalText(formData.get('study_notes_summary')),
    content_markdown: content,
    disclaimer: STUDY_NOTES_DISCLAIMER,
    status,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'session_id,language_code' })

  if (error) throw new Error(error.message)

  revalidatePath('/', 'layout')
  redirect(`/admin/sessions/${sessionId}?saved=notes`)
}

export async function saveTranscript(sessionId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const status = validStatus(formData.get('transcript_status'))
  const title = optionalText(formData.get('transcript_title')) ?? 'Reference Transcript'
  const rawText = requiredText(formData.get('transcript_content'), 'Transcript')

  const { data: existing, error: existingError } = await supabase
    .from('transcripts')
    .select('id')
    .eq('session_id', sessionId)
    .eq('language_code', 'en')
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)

  const transcriptId = existing?.id ?? randomUUID()
  const { sections, paragraphs } = parseTranscript(rawText, transcriptId)

  const { error: transcriptError } = await supabase.from('transcripts').upsert({
    id: transcriptId,
    session_id: sessionId,
    language_code: 'en',
    title,
    disclaimer: TRANSCRIPT_DISCLAIMER,
    source_file_name: optionalText(formData.get('transcript_source_file_name')),
    status,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'session_id,language_code' })

  if (transcriptError) throw new Error(transcriptError.message)

  const { error: deleteParagraphsError } = await supabase.from('transcript_paragraphs').delete().eq('transcript_id', transcriptId)
  if (deleteParagraphsError) throw new Error(deleteParagraphsError.message)

  const { error: deleteSectionsError } = await supabase.from('transcript_sections').delete().eq('transcript_id', transcriptId)
  if (deleteSectionsError) throw new Error(deleteSectionsError.message)

  if (sections.length > 0) {
    const { error } = await supabase.from('transcript_sections').insert(sections)
    if (error) throw new Error(error.message)
  }

  if (paragraphs.length > 0) {
    const { error } = await supabase.from('transcript_paragraphs').insert(paragraphs)
    if (error) throw new Error(error.message)
  }

  revalidatePath('/', 'layout')
  redirect(`/admin/sessions/${sessionId}?saved=transcript`)
}
