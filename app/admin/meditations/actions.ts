'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub as string | undefined
  if (!userId) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return supabase
}

function requiredText(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`${label} is required`)
  return text
}

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
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
    .replace(/^-+|-+$/g, '') || 'meditation'
}

function secondsFromMinutes(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return null
  const minutes = Number(text)
  if (!Number.isFinite(minutes) || minutes < 0) throw new Error('Duration must be a positive number of minutes')
  return Math.round(minutes * 60)
}

function integerSeconds(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return null
  const seconds = Number(text)
  if (!Number.isInteger(seconds) || seconds < 0) throw new Error('Timestamp must be a positive number of seconds')
  return seconds
}

export async function createMeditation(formData: FormData) {
  const supabase = await requireAdmin()
  const name = requiredText(formData.get('name'), 'Meditation name')
  const baseSlug = slugify(name)
  let slug = baseSlug
  let suffix = 2

  while (true) {
    const { data: existing, error } = await supabase.from('meditations').select('id').eq('slug', slug).maybeSingle()
    if (error) throw new Error(error.message)
    if (!existing) break
    slug = `${baseSlug}-${suffix++}`
  }

  const topics = String(formData.get('topics') ?? '')
    .split(',')
    .map((topic) => topic.trim())
    .filter(Boolean)

  const { error } = await supabase.from('meditations').insert({
    slug,
    name,
    description: optionalText(formData.get('description')),
    topics,
    status: validStatus(formData.get('status')),
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/meditations')
  revalidatePath('/meditations')
  redirect('/admin/meditations?created=meditation')
}

export async function updateMeditation(meditationId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const topics = String(formData.get('topics') ?? '')
    .split(',')
    .map((topic) => topic.trim())
    .filter(Boolean)

  const { error } = await supabase
    .from('meditations')
    .update({
      name: requiredText(formData.get('name'), 'Meditation name'),
      description: optionalText(formData.get('description')),
      topics,
      status: validStatus(formData.get('status')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', meditationId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/meditations')
  revalidatePath('/meditations')
  redirect('/admin/meditations?saved=meditation')
}

export async function createMeditationInstance(formData: FormData) {
  const supabase = await requireAdmin()
  const meditationId = requiredText(formData.get('meditation_id'), 'Meditation')
  const sessionId = requiredText(formData.get('session_id'), 'Source session')

  const { data: duplicate, error: duplicateError } = await supabase
    .from('meditation_instances')
    .select('id')
    .eq('meditation_id', meditationId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (duplicateError) throw new Error(duplicateError.message)
  if (duplicate) throw new Error('This source session is already linked to that meditation.')

  const { error } = await supabase.from('meditation_instances').insert({
    meditation_id: meditationId,
    session_id: sessionId,
    teacher_id: optionalText(formData.get('teacher_id')),
    title: optionalText(formData.get('title')),
    start_seconds: integerSeconds(formData.get('start_seconds')),
    end_seconds: integerSeconds(formData.get('end_seconds')),
    duration_seconds: secondsFromMinutes(formData.get('duration_minutes')),
    audio_url: optionalText(formData.get('audio_url')),
    status: validStatus(formData.get('status')),
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/meditations')
  revalidatePath('/meditations')
  redirect('/admin/meditations?created=version')
}

export async function updateMeditationInstance(instanceId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const { error } = await supabase
    .from('meditation_instances')
    .update({
      title: optionalText(formData.get('title')),
      teacher_id: optionalText(formData.get('teacher_id')),
      start_seconds: integerSeconds(formData.get('start_seconds')),
      end_seconds: integerSeconds(formData.get('end_seconds')),
      duration_seconds: secondsFromMinutes(formData.get('duration_minutes')),
      audio_url: optionalText(formData.get('audio_url')),
      status: validStatus(formData.get('status')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', instanceId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/meditations')
  revalidatePath('/meditations')
  redirect('/admin/meditations?saved=version')
}
