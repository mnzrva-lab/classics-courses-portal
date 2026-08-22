'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const MATERIAL_TYPES = ['reading', 'slides', 'audio', 'video', 'document', 'link', 'other'] as const
const TEACHING_MATERIALS_BUCKET = 'teaching-materials'

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

function validMaterialType(value: FormDataEntryValue | null) {
  const type = String(value ?? 'link')
  if (!MATERIAL_TYPES.includes(type as (typeof MATERIAL_TYPES)[number])) throw new Error('Invalid material type')
  return type
}

function safeFileName(name: string) {
  const dot = name.lastIndexOf('.')
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file'
  const extension = dot > 0 ? name.slice(dot + 1).replace(/[^A-Za-z0-9]+/g, '').slice(0, 12) : ''
  return extension ? `${stem}.${extension}` : stem
}

async function nextSortOrder(supabase: Awaited<ReturnType<typeof createClient>>, offeringId: string) {
  const { data, error } = await supabase
    .from('materials')
    .select('sort_order')
    .eq('offering_id', offeringId)
    .is('session_id', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data?.sort_order ?? -1) + 1
}

function revalidateOffering(offeringId: string) {
  revalidatePath('/admin')
  revalidatePath(`/admin/offerings/${offeringId}`)
  revalidatePath(`/admin/offerings/${offeringId}/review`)
  revalidatePath('/', 'layout')
}

export async function createOfferingMaterialUploadUrl(offeringId: string, fileName: string) {
  const supabase = await requireAdmin()
  const storagePath = `offerings/${offeringId}/${randomUUID()}-${safeFileName(fileName)}`
  const { data, error } = await supabase.storage.from(TEACHING_MATERIALS_BUCKET).createSignedUploadUrl(storagePath)
  if (error || !data?.token) throw new Error(error?.message ?? 'Could not prepare upload.')
  return { storagePath, token: data.token }
}

export async function addOfferingMaterial(offeringId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const { error } = await supabase.from('materials').insert({
    offering_id: offeringId,
    session_id: null,
    course_id: null,
    material_type: validMaterialType(formData.get('material_type')),
    title: requiredText(formData.get('material_title'), 'Material title'),
    url: requiredText(formData.get('material_url'), 'Material URL'),
    mime_type: optionalText(formData.get('material_mime_type')),
    status: validStatus(formData.get('material_status')),
    sort_order: await nextSortOrder(supabase, offeringId),
  })

  if (error) throw new Error(error.message)
  revalidateOffering(offeringId)
  redirect(`/admin/offerings/${offeringId}?saved=offering-material`)
}

export async function registerOfferingUploadedMaterial(offeringId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const storagePath = requiredText(formData.get('storage_path'), 'Uploaded file')
  const originalName = requiredText(formData.get('original_name'), 'File name')
  const expectedPrefix = `offerings/${offeringId}/`

  if (!storagePath.startsWith(expectedPrefix) || storagePath.includes('..')) throw new Error('Invalid upload path.')

  const { error } = await supabase.from('materials').insert({
    offering_id: offeringId,
    session_id: null,
    course_id: null,
    material_type: validMaterialType(formData.get('material_type')),
    title: optionalText(formData.get('material_title')) ?? originalName,
    url: null,
    mime_type: optionalText(formData.get('material_mime_type')),
    status: validStatus(formData.get('material_status')),
    sort_order: await nextSortOrder(supabase, offeringId),
    storage_bucket: TEACHING_MATERIALS_BUCKET,
    storage_path: storagePath,
  })

  if (error) {
    await supabase.storage.from(TEACHING_MATERIALS_BUCKET).remove([storagePath])
    throw new Error(error.message)
  }

  revalidateOffering(offeringId)
  redirect(`/admin/offerings/${offeringId}?saved=offering-material`)
}

export async function updateOfferingMaterial(offeringId: string, materialId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const { data: existing, error: readError } = await supabase
    .from('materials')
    .select('storage_path')
    .eq('id', materialId)
    .eq('offering_id', offeringId)
    .is('session_id', null)
    .single()

  if (readError) throw new Error(readError.message)

  const url = optionalText(formData.get('material_url'))
  if (!url && !existing?.storage_path) throw new Error('Material URL is required for linked resources.')

  const { error } = await supabase
    .from('materials')
    .update({
      material_type: validMaterialType(formData.get('material_type')),
      title: requiredText(formData.get('material_title'), 'Material title'),
      url,
      mime_type: optionalText(formData.get('material_mime_type')),
      status: validStatus(formData.get('material_status')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', materialId)
    .eq('offering_id', offeringId)
    .is('session_id', null)

  if (error) throw new Error(error.message)
  revalidateOffering(offeringId)
  redirect(`/admin/offerings/${offeringId}?saved=offering-material`)
}

export async function deleteOfferingMaterial(offeringId: string, materialId: string) {
  const supabase = await requireAdmin()
  const { data: existing, error: readError } = await supabase
    .from('materials')
    .select('storage_bucket, storage_path')
    .eq('id', materialId)
    .eq('offering_id', offeringId)
    .is('session_id', null)
    .single()

  if (readError) throw new Error(readError.message)

  if (existing?.storage_bucket && existing.storage_path) {
    const { error: storageError } = await supabase.storage.from(existing.storage_bucket).remove([existing.storage_path])
    if (storageError) throw new Error(`Could not remove uploaded file: ${storageError.message}`)
  }

  const { error } = await supabase
    .from('materials')
    .delete()
    .eq('id', materialId)
    .eq('offering_id', offeringId)
    .is('session_id', null)

  if (error) throw new Error(error.message)
  revalidateOffering(offeringId)
  redirect(`/admin/offerings/${offeringId}?saved=offering-material`)
}
