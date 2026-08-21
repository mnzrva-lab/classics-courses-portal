'use server'

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

function text(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value: FormDataEntryValue | null) {
  const valueText = text(value)
  return valueText || null
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function validStatus(value: FormDataEntryValue | null) {
  const status = text(value) || 'draft'
  if (!['draft', 'published', 'archived'].includes(status)) throw new Error('Invalid status')
  return status
}

function parseLanguages(value: FormDataEntryValue | null) {
  return Array.from(new Set(text(value)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)))
}

export async function createOffering(formData: FormData) {
  const supabase = await requireAdmin()
  const courseId = text(formData.get('course_id'))
  const label = text(formData.get('label'))
  if (!courseId) throw new Error('Choose a course')
  if (!label) throw new Error('Student-facing label is required')

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .maybeSingle()
  if (courseError) throw new Error(courseError.message)
  if (!course) throw new Error('Course not found')

  const yearText = text(formData.get('year'))
  const year = yearText ? Number(yearText) : null
  if (year != null && (!Number.isInteger(year) || year < 1900 || year > 2200)) throw new Error('Enter a valid year')

  const requestedSlug = slugify(text(formData.get('slug')) || label) || 'offering'
  const { data: existingSlugs, error: slugError } = await supabase
    .from('course_offerings')
    .select('slug')
    .eq('course_id', courseId)
    .like('slug', `${requestedSlug}%`)
  if (slugError) throw new Error(slugError.message)

  const used = new Set((existingSlugs ?? []).map((row) => row.slug))
  let slug = requestedSlug
  let suffix = 2
  while (used.has(slug)) slug = `${requestedSlug}-${suffix++}`

  const { data: lastOffering, error: sortError } = await supabase
    .from('course_offerings')
    .select('sort_order')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (sortError) throw new Error(sortError.message)

  const { data: offering, error } = await supabase
    .from('course_offerings')
    .insert({
      course_id: courseId,
      slug,
      label,
      location: optionalText(formData.get('location')),
      year,
      language_codes: parseLanguages(formData.get('language_codes')),
      artwork_url: optionalText(formData.get('artwork_url')),
      description: optionalText(formData.get('description')),
      telegram_url: optionalText(formData.get('telegram_url')),
      starts_on: optionalText(formData.get('starts_on')),
      ends_on: optionalText(formData.get('ends_on')),
      status: validStatus(formData.get('status')),
      sort_order: (lastOffering?.sort_order ?? -1) + 1,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  redirect(`/admin/offerings/${offering.id}?created=1`)
}
