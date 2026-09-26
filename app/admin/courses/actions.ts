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

function validNewKind(value: FormDataEntryValue | null) {
  const kind = text(value) || 'other'
  if (!['book', 'other'].includes(kind)) throw new Error('New programs can be created as Other Program or Text Study')
  return kind
}

async function uniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, requested: string, excludeId?: string) {
  const base = slugify(requested) || 'program'
  const { data, error } = await supabase.from('courses').select('id, slug').like('slug', `${base}%`)
  if (error) throw new Error(error.message)
  const used = new Set((data ?? []).filter((row) => row.id !== excludeId).map((row) => row.slug))
  let slug = base
  let suffix = 2
  while (used.has(slug)) slug = `${base}-${suffix++}`
  return slug
}

async function nextSortOrder(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from('courses')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.sort_order ?? 0) + 1
}

function finish(message: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/courses')
  revalidatePath('/courses')
  revalidatePath('/other-programs')
  revalidatePath('/', 'layout')
  redirect(`/admin/courses?saved=${encodeURIComponent(message)}`)
}

export async function createProgram(formData: FormData) {
  const supabase = await requireAdmin()
  const title = text(formData.get('title'))
  if (!title) throw new Error('Program title is required')

  const slug = await uniqueSlug(supabase, text(formData.get('slug')) || title)
  const { error } = await supabase.from('courses').insert({
    kind: validNewKind(formData.get('kind')),
    canonical_number: null,
    slug,
    title,
    subtitle: optionalText(formData.get('subtitle')),
    description: optionalText(formData.get('description')),
    status: validStatus(formData.get('status')),
    sort_order: await nextSortOrder(supabase),
  })

  if (error) throw new Error(error.message)
  finish('created')
}

export async function updateCourse(courseId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const { data: existing, error: readError } = await supabase
    .from('courses')
    .select('id, kind, title, slug')
    .eq('id', courseId)
    .single()
  if (readError) throw new Error(readError.message)

  const protectedTitle = existing.kind === 'classics' || existing.kind === 'living_lam_rim'
  const title = protectedTitle ? existing.title : text(formData.get('title'))
  if (!title) throw new Error('Program title is required')

  const slug = protectedTitle
    ? existing.slug
    : await uniqueSlug(supabase, text(formData.get('slug')) || title, courseId)

  const update: Record<string, unknown> = {
    title,
    slug,
    subtitle: optionalText(formData.get('subtitle')),
    description: optionalText(formData.get('description')),
    status: validStatus(formData.get('status')),
    updated_at: new Date().toISOString(),
  }

  if (existing.kind === 'book' || existing.kind === 'other') {
    const requestedKind = text(formData.get('kind'))
    if (requestedKind && !['book', 'other'].includes(requestedKind)) throw new Error('Invalid program type')
    update.kind = requestedKind || existing.kind
  }

  const { error } = await supabase.from('courses').update(update).eq('id', courseId)
  if (error) throw new Error(error.message)
  finish('updated')
}
