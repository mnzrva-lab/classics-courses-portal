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

function integerValue(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return 0
  const number = Number(text)
  if (!Number.isInteger(number)) throw new Error('Sort order must be a whole number')
  return number
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tibetan-term'
}

function aliases(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function createTibetanTerm(formData: FormData) {
  const supabase = await requireAdmin()
  const transliteration = requiredText(formData.get('transliteration'), 'Transliteration')
  const baseSlug = slugify(transliteration)
  let slug = baseSlug
  let suffix = 2

  while (true) {
    const { data: existing, error } = await supabase.from('tibetan_terms').select('id').eq('slug', slug).maybeSingle()
    if (error) throw new Error(error.message)
    if (!existing) break
    slug = `${baseSlug}-${suffix++}`
  }

  const { error } = await supabase.from('tibetan_terms').insert({
    slug,
    tibetan_script: optionalText(formData.get('tibetan_script')),
    transliteration,
    english_meaning: requiredText(formData.get('english_meaning'), 'English meaning'),
    explanation: optionalText(formData.get('explanation')),
    aliases: aliases(formData.get('aliases')),
    status: validStatus(formData.get('status')),
    sort_order: integerValue(formData.get('sort_order')),
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/tibetan')
  revalidatePath('/tibetan')
  redirect('/admin/tibetan?created=term')
}

export async function updateTibetanTerm(termId: string, termSlug: string, formData: FormData) {
  const supabase = await requireAdmin()
  const { error } = await supabase
    .from('tibetan_terms')
    .update({
      tibetan_script: optionalText(formData.get('tibetan_script')),
      transliteration: requiredText(formData.get('transliteration'), 'Transliteration'),
      english_meaning: requiredText(formData.get('english_meaning'), 'English meaning'),
      explanation: optionalText(formData.get('explanation')),
      aliases: aliases(formData.get('aliases')),
      status: validStatus(formData.get('status')),
      sort_order: integerValue(formData.get('sort_order')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', termId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/tibetan')
  revalidatePath('/tibetan')
  revalidatePath(`/tibetan/${termSlug}`)
  redirect('/admin/tibetan?saved=term')
}

export async function addTibetanSource(termId: string, termSlug: string, formData: FormData) {
  const supabase = await requireAdmin()
  const sourceLabel = optionalText(formData.get('source_label'))
  const externalUrl = optionalText(formData.get('external_url'))
  const sessionId = optionalText(formData.get('session_id'))

  if (!sourceLabel && !externalUrl && !sessionId) {
    throw new Error('Add a source session, source label, or external URL.')
  }

  const { error } = await supabase.from('tibetan_term_sources').insert({
    term_id: termId,
    session_id: sessionId,
    source_label: sourceLabel,
    external_url: externalUrl,
    note: optionalText(formData.get('note')),
    sort_order: integerValue(formData.get('sort_order')),
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/tibetan')
  revalidatePath(`/tibetan/${termSlug}`)
  redirect('/admin/tibetan?created=source')
}

export async function deleteTibetanSource(sourceId: string, termSlug: string) {
  const supabase = await requireAdmin()
  const { error } = await supabase.from('tibetan_term_sources').delete().eq('id', sourceId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/tibetan')
  revalidatePath(`/tibetan/${termSlug}`)
  redirect('/admin/tibetan?saved=source-deleted')
}
