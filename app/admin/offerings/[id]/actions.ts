'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isValidTimeZone, zonedLocalToIso } from '@/lib/timezone'

const ARTWORK_BUCKET = 'course-artwork'
const ARTWORK_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

async function requireAdmin() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub as string | undefined
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'session'
}

function safeFileName(value: string) {
  const dot = value.lastIndexOf('.')
  const stem = (dot > 0 ? value.slice(0, dot) : value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'artwork'
  const extension = dot > 0 ? value.slice(dot + 1).replace(/[^A-Za-z0-9]+/g, '').slice(0, 8) : ''
  return extension ? `${stem}.${extension}` : stem
}

function parseLanguages(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value : ''
  return Array.from(new Set(text.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)))
}

function normalizeTimezoneAlias(value: string | null) {
  if (!value) return null
  const text = value.trim()
  if (isValidTimeZone(text)) return text
  const key = text.toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim()
  const aliases: Record<string, string> = {
    arizona: 'America/Phoenix',
    'arizona time': 'America/Phoenix',
    phoenix: 'America/Phoenix',
    az: 'America/Phoenix',
    mst: 'America/Phoenix',
    taiwan: 'Asia/Taipei',
    'taiwan time': 'Asia/Taipei',
    taipei: 'Asia/Taipei',
    japan: 'Asia/Tokyo',
    'japan time': 'Asia/Tokyo',
    kyoto: 'Asia/Tokyo',
    tokyo: 'Asia/Tokyo',
    jst: 'Asia/Tokyo',
    spain: 'Europe/Madrid',
    barcelona: 'Europe/Madrid',
    madrid: 'Europe/Madrid',
    romania: 'Europe/Bucharest',
    bucharest: 'Europe/Bucharest',
    germany: 'Europe/Berlin',
    berlin: 'Europe/Berlin',
    utc: 'UTC',
    gmt: 'UTC',
  }
  return aliases[key] ?? null
}

function inferOfferingTimezone(...values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(' ').toLowerCase()
  if (/\barizona\b|\bphoenix\b/.test(text)) return 'America/Phoenix'
  if (/\btaiwan\b|\btaipei\b/.test(text)) return 'Asia/Taipei'
  if (/\bjapan\b|\bkyoto\b|\btokyo\b/.test(text)) return 'Asia/Tokyo'
  if (/\bspain\b|\bbarcelona\b|\bmadrid\b/.test(text)) return 'Europe/Madrid'
  if (/\bromania\b|\bbucharest\b/.test(text)) return 'Europe/Bucharest'
  if (/\bgermany\b|\bberlin\b/.test(text)) return 'Europe/Berlin'
  return null
}

function revalidateOffering(offeringId: string) {
  revalidatePath('/admin')
  revalidatePath(`/admin/offerings/${offeringId}`)
  revalidatePath('/', 'layout')
}

export async function updateOffering(offeringId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const yearText = optionalText(formData.get('year'))
  const year = yearText ? Number(yearText) : null
  if (yearText && (!Number.isInteger(year) || year! < 1900 || year! > 2200)) throw new Error('Enter a valid year.')

  const { error } = await supabase
    .from('course_offerings')
    .update({
      label: requiredText(formData.get('label'), 'Course Offering label'),
      location: optionalText(formData.get('location')),
      year,
      language_codes: parseLanguages(formData.get('language_codes')),
      artwork_url: optionalText(formData.get('artwork_url')),
      description: optionalText(formData.get('description')),
      starts_on: optionalText(formData.get('starts_on')),
      ends_on: optionalText(formData.get('ends_on')),
      status: validStatus(formData.get('status')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', offeringId)

  if (error) throw new Error(error.message)
  revalidateOffering(offeringId)
  redirect(`/admin/offerings/${offeringId}?saved=offering`)
}

export async function deleteUnusedOffering(offeringId: string, formData: FormData) {
  const supabase = await requireAdmin()
  if (String(formData.get('confirm_delete') ?? '').trim() !== 'DELETE') throw new Error('Type DELETE to confirm permanent deletion.')

  const { data: offering, error: offeringError } = await supabase
    .from('course_offerings')
    .select('id, label, status, artwork_url')
    .eq('id', offeringId)
    .single()
  if (offeringError || !offering) throw new Error('Course Offering was not found.')
  if (offering.status === 'published') throw new Error('Published Course Offerings cannot be permanently deleted. Set it to Draft or Archived first.')
  if (offering.artwork_url) throw new Error('Remove the Course Offering artwork before permanent deletion so its Storage file is not left behind.')

  const { data: sessionRows, error: sessionsError } = await supabase.from('sessions').select('id').eq('offering_id', offeringId)
  if (sessionsError) throw new Error(sessionsError.message)
  const sessionIds = (sessionRows ?? []).map((row) => row.id)

  const { data: storedMaterials, error: materialError } = await supabase
    .from('materials')
    .select('id, storage_bucket, storage_path')
    .eq('offering_id', offeringId)
    .not('storage_path', 'is', null)
    .limit(1)
  if (materialError) throw new Error(materialError.message)
  if ((storedMaterials ?? []).length) throw new Error('Remove uploaded files from this Course Offering before permanent deletion so Storage files are not left behind.')

  if (sessionIds.length) {
    const [notesResult, progressResult, bookmarkResult, meditationResult, tibetanResult, transcriptResult] = await Promise.all([
      supabase.from('student_notes').select('id').in('session_id', sessionIds).limit(1),
      supabase.from('user_session_progress').select('session_id').in('session_id', sessionIds).limit(1),
      supabase.from('user_session_bookmarks').select('session_id').in('session_id', sessionIds).limit(1),
      supabase.from('meditation_instances').select('id').in('session_id', sessionIds).limit(1),
      supabase.from('tibetan_term_sources').select('id').in('session_id', sessionIds).limit(1),
      supabase.from('transcripts').select('id').in('session_id', sessionIds),
    ])

    const queryError = notesResult.error || progressResult.error || bookmarkResult.error || meditationResult.error || tibetanResult.error || transcriptResult.error
    if (queryError) throw new Error(queryError.message)
    if ((notesResult.data ?? []).length || (progressResult.data ?? []).length || (bookmarkResult.data ?? []).length) {
      throw new Error('This Course Offering has student notes, progress, or bookmarks. Archive it instead of deleting it.')
    }
    if ((meditationResult.data ?? []).length || (tibetanResult.data ?? []).length) {
      throw new Error('This Course Offering is already linked from the meditation or Tibetan study library. Remove those source links or archive the offering instead.')
    }

    const transcriptIds = (transcriptResult.data ?? []).map((row) => row.id)
    if (transcriptIds.length) {
      const { data: paragraphs, error: paragraphError } = await supabase.from('transcript_paragraphs').select('id').in('transcript_id', transcriptIds)
      if (paragraphError) throw new Error(paragraphError.message)
      const paragraphIds = (paragraphs ?? []).map((row) => row.id)
      if (paragraphIds.length) {
        const { data: paragraphBookmarks, error: paragraphBookmarkError } = await supabase.from('user_paragraph_bookmarks').select('paragraph_id').in('paragraph_id', paragraphIds).limit(1)
        if (paragraphBookmarkError) throw new Error(paragraphBookmarkError.message)
        if ((paragraphBookmarks ?? []).length) throw new Error('This Course Offering has bookmarked transcript passages. Archive it instead of deleting it.')
      }
    }
  }

  const { error: deleteError } = await supabase.from('course_offerings').delete().eq('id', offeringId)
  if (deleteError) throw new Error(deleteError.message)

  revalidatePath('/admin')
  revalidatePath('/admin/courses')
  revalidatePath('/courses')
  revalidatePath('/', 'layout')
  redirect('/admin/courses?deleted=offering')
}

export async function createArtworkUploadUrl(offeringId: string, fileName: string, contentType: string) {
  const supabase = await requireAdmin()
  if (!ARTWORK_TYPES.has(contentType)) throw new Error('Artwork must be a JPG, PNG, or WebP image.')

  const storagePath = `offerings/${offeringId}/${randomUUID()}-${safeFileName(fileName)}`
  const { data, error } = await supabase.storage.from(ARTWORK_BUCKET).createSignedUploadUrl(storagePath)
  if (error || !data?.token) throw new Error(error?.message ?? 'Could not prepare artwork upload.')
  return { storagePath, token: data.token }
}

export async function registerArtworkUpload(offeringId: string, storagePath: string) {
  const supabase = await requireAdmin()
  const expectedPrefix = `offerings/${offeringId}/`
  if (!storagePath.startsWith(expectedPrefix) || storagePath.includes('..')) throw new Error('Invalid artwork path.')

  const { data } = supabase.storage.from(ARTWORK_BUCKET).getPublicUrl(storagePath)
  const artworkUrl = data.publicUrl
  const { error } = await supabase
    .from('course_offerings')
    .update({ artwork_url: artworkUrl, updated_at: new Date().toISOString() })
    .eq('id', offeringId)
  if (error) throw new Error(error.message)

  revalidateOffering(offeringId)
  return { artworkUrl }
}

export async function createSession(offeringId: string, courseId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const title = requiredText(formData.get('title'), 'Title')
  const code = optionalText(formData.get('code'))
  const sessionType = String(formData.get('session_type') ?? 'class')
  if (!['class', 'meditation', 'review', 'qna', 'vows', 'other'].includes(sessionType)) throw new Error('Invalid session type')

  const [{ data: offering, error: offeringError }, { data: siblingRows, error: siblingError }] = await Promise.all([
    supabase.from('course_offerings').select('label, location, starts_on, ends_on').eq('id', offeringId).single(),
    supabase.from('sessions').select('slug, sort_order, source_timezone').eq('offering_id', offeringId),
  ])
  if (offeringError || !offering) throw new Error('Course Offering could not be loaded.')
  if (siblingError) throw new Error(siblingError.message)

  const sessionDate = optionalText(formData.get('session_date'))
  const submittedTimezone = optionalText(formData.get('source_timezone'))
  const startTime = optionalText(formData.get('start_time'))
  const endTime = optionalText(formData.get('end_time'))
  const existingTimezone = (siblingRows ?? [])
    .map((row) => normalizeTimezoneAlias(row.source_timezone ?? null))
    .find((value): value is string => Boolean(value)) ?? null
  const inferredTimezone = inferOfferingTimezone(offering.location, offering.label)
  const staleTaipeiFallback = !existingTimezone && inferredTimezone && submittedTimezone === 'Asia/Taipei' && inferredTimezone !== 'Asia/Taipei'
  const sourceTimezone = staleTaipeiFallback
    ? inferredTimezone
    : normalizeTimezoneAlias(submittedTimezone) ?? existingTimezone ?? inferredTimezone ?? 'UTC'

  if (submittedTimezone && !staleTaipeiFallback && !normalizeTimezoneAlias(submittedTimezone)) {
    throw new Error('Source timezone was not recognized. For Arizona use America/Phoenix; for Taiwan use Asia/Taipei.')
  }
  if ((startTime || endTime) && !sessionDate) throw new Error('Choose the session date before entering a start or end time.')

  const startsAt = sessionDate && startTime ? zonedLocalToIso(sessionDate, startTime, sourceTimezone) : null
  const endsAt = sessionDate && endTime ? zonedLocalToIso(sessionDate, endTime, sourceTimezone) : null

  const baseSlug = slugify(code || title)
  const usedSlugs = new Set((siblingRows ?? []).map((row) => row.slug))
  let slug = baseSlug
  let suffix = 2
  while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`
  const sortOrder = Math.max(0, ...(siblingRows ?? []).map((row) => row.sort_order ?? 0)) + 10

  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      course_id: courseId,
      offering_id: offeringId,
      slug,
      code,
      title,
      session_type: sessionType,
      session_date: sessionDate,
      starts_at: startsAt,
      ends_at: endsAt,
      source_timezone: sourceTimezone,
      recording_url: optionalText(formData.get('recording_url')),
      audio_url: optionalText(formData.get('audio_url')),
      zoom_url: optionalText(formData.get('zoom_url')),
      required_for_completion: formData.get('required_for_completion') === 'on',
      status: validStatus(formData.get('status')),
      sort_order: sortOrder,
    })
    .select('id')
    .single()

  if (error || !session) throw new Error(error?.message ?? 'Could not create session.')

  const teacherIds = formData.getAll('teacher_id').map(String).filter(Boolean)
  if (teacherIds.length > 0) {
    const { error: teacherError } = await supabase.from('session_teachers').insert(
      teacherIds.map((teacherId, index) => ({ session_id: session.id, teacher_id: teacherId, sort_order: index }))
    )
    if (teacherError) {
      await supabase.from('sessions').delete().eq('id', session.id)
      throw new Error(teacherError.message)
    }
  }

  if (sessionDate) {
    const startsOn = !offering.starts_on || sessionDate < offering.starts_on ? sessionDate : offering.starts_on
    const endsOn = !offering.ends_on || sessionDate > offering.ends_on ? sessionDate : offering.ends_on
    if (startsOn !== offering.starts_on || endsOn !== offering.ends_on) {
      await supabase.from('course_offerings').update({ starts_on: startsOn, ends_on: endsOn, updated_at: new Date().toISOString() }).eq('id', offeringId)
    }
  }

  revalidatePath('/admin')
  revalidatePath(`/admin/offerings/${offeringId}`)
  revalidatePath('/', 'layout')
  redirect(`/admin/sessions/${session.id}?created=1`)
}
