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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function uniqueSlug(supabase: Awaited<ReturnType<typeof createClient>>, requested: string, excludeId?: string) {
  const base = slugify(requested) || 'teacher'
  const { data, error } = await supabase.from('teachers').select('id, slug').like('slug', `${base}%`)
  if (error) throw new Error(error.message)
  const used = new Set((data ?? []).filter((row) => row.id !== excludeId).map((row) => row.slug))
  let slug = base
  let suffix = 2
  while (used.has(slug)) slug = `${base}-${suffix++}`
  return slug
}

function finish(message: string) {
  revalidatePath('/admin')
  revalidatePath('/admin/teachers')
  revalidatePath('/', 'layout')
  redirect(`/admin/teachers?saved=${encodeURIComponent(message)}`)
}

export async function createTeacher(formData: FormData) {
  const supabase = await requireAdmin()
  const fullName = text(formData.get('full_name'))
  if (!fullName) throw new Error('Teacher name is required')
  const requestedSlug = text(formData.get('slug')) || fullName
  const slug = await uniqueSlug(supabase, requestedSlug)

  const { error } = await supabase.from('teachers').insert({
    full_name: fullName,
    slug,
    bio: text(formData.get('bio')) || null,
    active: formData.get('active') === 'on',
  })
  if (error) throw new Error(error.message)
  finish('created')
}

export async function updateTeacher(teacherId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const fullName = text(formData.get('full_name'))
  if (!fullName) throw new Error('Teacher name is required')

  const requestedSlug = text(formData.get('slug')) || fullName
  const slug = await uniqueSlug(supabase, requestedSlug, teacherId)
  const { error } = await supabase
    .from('teachers')
    .update({
      full_name: fullName,
      slug,
      bio: text(formData.get('bio')) || null,
      active: formData.get('active') === 'on',
    })
    .eq('id', teacherId)

  if (error) throw new Error(error.message)
  finish('updated')
}
