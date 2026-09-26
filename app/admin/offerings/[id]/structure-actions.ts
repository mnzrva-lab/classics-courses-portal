'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const GROUP_KINDS = ['term', 'season', 'part', 'module', 'other'] as const
const STATUSES = ['draft', 'published', 'archived'] as const

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
  return text(value) || null
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section'
}

function validKind(value: FormDataEntryValue | null) {
  const kind = text(value) || 'term'
  if (!GROUP_KINDS.includes(kind as (typeof GROUP_KINDS)[number])) throw new Error('Invalid section type')
  return kind
}

function validStatus(value: FormDataEntryValue | null) {
  const status = text(value) || 'draft'
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) throw new Error('Invalid status')
  return status
}

function parseSortOrder(value: FormDataEntryValue | null, fallback: number) {
  const raw = text(value)
  if (!raw) return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000) throw new Error('Sort order must be a non-negative whole number')
  return parsed
}

async function assertOfferingCourse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  offeringId: string,
  courseId: string,
) {
  const { data, error } = await supabase
    .from('course_offerings')
    .select('id, course_id')
    .eq('id', offeringId)
    .eq('course_id', courseId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Course Offering does not match this course')
}

export async function createContentGroup(offeringId: string, courseId: string, formData: FormData) {
  const supabase = await requireAdmin()
  await assertOfferingCourse(supabase, offeringId, courseId)

  const label = text(formData.get('label'))
  if (!label) throw new Error('Section label is required')
  const title = optionalText(formData.get('title'))
  const requestedSlug = slugify(text(formData.get('slug')) || title || label)

  const { data: siblings, error: siblingError } = await supabase
    .from('content_groups')
    .select('slug, sort_order')
    .eq('offering_id', offeringId)
  if (siblingError) throw new Error(siblingError.message)

  const usedSlugs = new Set((siblings ?? []).map((row) => row.slug))
  let slug = requestedSlug
  let suffix = 2
  while (usedSlugs.has(slug)) slug = `${requestedSlug}-${suffix++}`

  const defaultSort = Math.max(-10, ...(siblings ?? []).map((row) => row.sort_order ?? 0)) + 10
  const { error } = await supabase.from('content_groups').insert({
    course_id: courseId,
    offering_id: offeringId,
    parent_group_id: null,
    kind: validKind(formData.get('kind')),
    slug,
    label,
    title,
    starts_on: optionalText(formData.get('starts_on')),
    ends_on: optionalText(formData.get('ends_on')),
    status: validStatus(formData.get('status')),
    sort_order: parseSortOrder(formData.get('sort_order'), defaultSort),
  })
  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/living-lam-rim')
  redirect(`/admin/offerings/${offeringId}?saved=structure`)
}

export async function updateContentGroup(offeringId: string, groupId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const { data: group, error: groupError } = await supabase
    .from('content_groups')
    .select('id, offering_id')
    .eq('id', groupId)
    .eq('offering_id', offeringId)
    .maybeSingle()
  if (groupError) throw new Error(groupError.message)
  if (!group) throw new Error('Section not found in this Course Offering')

  const label = text(formData.get('label'))
  if (!label) throw new Error('Section label is required')

  const { error } = await supabase
    .from('content_groups')
    .update({
      kind: validKind(formData.get('kind')),
      label,
      title: optionalText(formData.get('title')),
      starts_on: optionalText(formData.get('starts_on')),
      ends_on: optionalText(formData.get('ends_on')),
      status: validStatus(formData.get('status')),
      sort_order: parseSortOrder(formData.get('sort_order'), 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', groupId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin')
  revalidatePath('/living-lam-rim')
  redirect(`/admin/offerings/${offeringId}?saved=structure`)
}

export async function assignSessionGroup(offeringId: string, sessionId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const groupId = optionalText(formData.get('group_id'))

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, offering_id')
    .eq('id', sessionId)
    .eq('offering_id', offeringId)
    .maybeSingle()
  if (sessionError) throw new Error(sessionError.message)
  if (!session) throw new Error('Session not found in this Course Offering')

  if (groupId) {
    const { data: group, error: groupError } = await supabase
      .from('content_groups')
      .select('id')
      .eq('id', groupId)
      .eq('offering_id', offeringId)
      .maybeSingle()
    if (groupError) throw new Error(groupError.message)
    if (!group) throw new Error('Choose a section from this Course Offering')
  }

  const { error } = await supabase.from('sessions').update({ group_id: groupId }).eq('id', sessionId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/living-lam-rim')
  redirect(`/admin/offerings/${offeringId}?saved=structure`)
}
