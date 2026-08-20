'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isValidTimeZone, zonedLocalToIso } from '@/lib/timezone'

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

function parseLanguages(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value : ''
  return Array.from(new Set(text.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)))
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
      telegram_url: optionalText(formData.get('telegram_url')),
      starts_on: optionalText(formData.get('starts_on')),
      ends_on: optionalText(formData.get('ends_on')),
      status: validStatus(formData.get('status')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', offeringId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin')
  revalidatePath('/', 'layout')
  redirect(`/admin/offerings/${offeringId}?saved=offering`)
}

export async function createSession(offeringId: string, courseId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const title = requiredText(formData.get('title'), 'Title')
  const code = optionalText(formData.get('code'))
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

  const baseSlug = slugify(code || title)
  const { data: siblingRows, error: siblingError } = await supabase
    .from('sessions')
    .select('slug, sort_order')
    .eq('offering_id', offeringId)

  if (siblingError) throw new Error(siblingError.message)
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

  revalidatePath('/admin')
  revalidatePath('/', 'layout')
  redirect(`/admin/sessions/${session.id}?created=1`)
}
