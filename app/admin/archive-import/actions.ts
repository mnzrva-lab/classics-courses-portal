'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SESSION_TYPES = ['class', 'meditation', 'review', 'qna', 'vows', 'other'] as const
const STATUSES = ['draft', 'published', 'archived'] as const
const GROUP_KINDS = ['term', 'season', 'part', 'module', 'other'] as const

type ArchiveSessionInput = {
  sessionId?: string | null
  code: string
  title: string
  sessionType: string
  sessionDate?: string | null
  recordingUrl: string
  teacherIds: string[]
  status: string
  sortOrder: number
}

export type ArchiveBatchInput = {
  key: string
  courseId: string
  offeringId?: string | null
  offeringLabel: string
  location?: string | null
  year?: number | null
  languages: string[]
  offeringStatus: string
  playlistTitle?: string | null
  playlistUrl?: string | null
  groupKind?: string | null
  groupLabel?: string | null
  sessions: ArchiveSessionInput[]
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return supabase
}

function slugify(value: string, fallback = 'item') {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

function validStatus(value: string) {
  if (!STATUSES.includes(value as (typeof STATUSES)[number])) throw new Error(`Invalid status: ${value}`)
  return value
}

function validSessionType(value: string) {
  if (!SESSION_TYPES.includes(value as (typeof SESSION_TYPES)[number])) throw new Error(`Invalid session type: ${value}`)
  return value
}

async function nextOfferingSortOrder(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string) {
  const { data, error } = await supabase.from('course_offerings').select('sort_order').eq('course_id', courseId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.sort_order ?? -1) + 1
}

async function uniqueOfferingSlug(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string, label: string) {
  const base = slugify(label, 'archive')
  const { data, error } = await supabase.from('course_offerings').select('slug').eq('course_id', courseId).like('slug', `${base}%`)
  if (error) throw new Error(error.message)
  const used = new Set((data ?? []).map((row) => row.slug))
  let slug = base
  let suffix = 2
  while (used.has(slug)) slug = `${base}-${suffix++}`
  return slug
}

async function ensureOffering(supabase: Awaited<ReturnType<typeof createClient>>, batch: ArchiveBatchInput) {
  if (batch.offeringId) {
    const { data, error } = await supabase.from('course_offerings').select('id, course_id').eq('id', batch.offeringId).single()
    if (error || !data) throw new Error('Selected Course Offering was not found.')
    if (data.course_id !== batch.courseId) throw new Error('Selected Course Offering belongs to a different course.')
    return data.id
  }

  const dates = batch.sessions.map((session) => session.sessionDate).filter(Boolean).sort() as string[]
  const { data, error } = await supabase.from('course_offerings').insert({
    course_id: batch.courseId,
    slug: await uniqueOfferingSlug(supabase, batch.courseId, batch.offeringLabel),
    label: batch.offeringLabel.trim(),
    location: batch.location?.trim() || null,
    year: batch.year ?? null,
    language_codes: Array.from(new Set(batch.languages.map((item) => item.trim().toLowerCase()).filter(Boolean))),
    starts_on: dates[0] ?? null,
    ends_on: dates[dates.length - 1] ?? null,
    status: validStatus(batch.offeringStatus),
    sort_order: await nextOfferingSortOrder(supabase, batch.courseId),
  }).select('id').single()

  if (error || !data) throw new Error(error?.message ?? 'Could not create Course Offering.')
  return data.id
}

async function ensureGroup(supabase: Awaited<ReturnType<typeof createClient>>, batch: ArchiveBatchInput, offeringId: string) {
  const label = batch.groupLabel?.trim()
  if (!label) return null
  const kind = batch.groupKind?.trim() || 'module'
  if (!GROUP_KINDS.includes(kind as (typeof GROUP_KINDS)[number])) throw new Error(`Invalid section type: ${kind}`)
  const base = slugify(label, 'section')

  const { data: existing } = await supabase
    .from('content_groups')
    .select('id')
    .eq('course_id', batch.courseId)
    .eq('offering_id', offeringId)
    .eq('slug', base)
    .maybeSingle()
  if (existing?.id) return existing.id

  const { data: last } = await supabase.from('content_groups').select('sort_order').eq('offering_id', offeringId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const dates = batch.sessions.map((session) => session.sessionDate).filter(Boolean).sort() as string[]
  const { data, error } = await supabase.from('content_groups').insert({
    course_id: batch.courseId,
    offering_id: offeringId,
    parent_group_id: null,
    kind,
    slug: base,
    label,
    title: null,
    starts_on: dates[0] ?? null,
    ends_on: dates[dates.length - 1] ?? null,
    status: 'published',
    sort_order: (last?.sort_order ?? -1) + 1,
  }).select('id').single()
  if (error || !data) throw new Error(error?.message ?? 'Could not create program section.')
  return data.id
}

async function uniqueSessionSlug(supabase: Awaited<ReturnType<typeof createClient>>, courseId: string, offeringId: string, groupId: string | null, proposed: string) {
  const base = slugify(proposed, 'session')
  const { data, error } = await supabase.from('sessions').select('slug').eq('course_id', courseId).eq('offering_id', offeringId).like('slug', `${base}%`)
  if (error) throw new Error(error.message)
  const used = new Set((data ?? []).map((row) => row.slug))
  let slug = base
  let suffix = 2
  while (used.has(slug)) slug = `${base}-${suffix++}`
  return slug
}

async function replaceTeachers(supabase: Awaited<ReturnType<typeof createClient>>, sessionId: string, teacherIds: string[]) {
  const unique = Array.from(new Set(teacherIds.filter(Boolean)))
  const { error: deleteError } = await supabase.from('session_teachers').delete().eq('session_id', sessionId)
  if (deleteError) throw new Error(deleteError.message)
  if (!unique.length) return
  const { error } = await supabase.from('session_teachers').insert(unique.map((teacherId, index) => ({ session_id: sessionId, teacher_id: teacherId, sort_order: index })))
  if (error) throw new Error(error.message)
}

async function savePlaylist(supabase: Awaited<ReturnType<typeof createClient>>, offeringId: string, title: string | null | undefined, url: string | null | undefined) {
  if (!url?.trim()) return
  const cleanUrl = url.trim()
  const { data: existing } = await supabase.from('materials').select('id').eq('offering_id', offeringId).is('session_id', null).eq('url', cleanUrl).maybeSingle()
  if (existing?.id) return
  const { data: last } = await supabase.from('materials').select('sort_order').eq('offering_id', offeringId).is('session_id', null).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const { error } = await supabase.from('materials').insert({
    offering_id: offeringId,
    session_id: null,
    course_id: null,
    material_type: 'video',
    title: title?.trim() || 'Course recordings',
    url: cleanUrl,
    status: 'published',
    sort_order: (last?.sort_order ?? -1) + 1,
  })
  if (error) throw new Error(error.message)
}

export async function applyArchiveBatches(batches: ArchiveBatchInput[]) {
  const supabase = await requireAdmin()
  if (!Array.isArray(batches) || !batches.length) return { ok: false, message: 'Choose at least one CSV to import.' }

  let createdOfferings = 0
  let createdSessions = 0
  let updatedSessions = 0

  try {
    for (const batch of batches) {
      if (!batch.courseId) throw new Error('Every CSV needs a course assignment.')
      if (!batch.offeringId && !batch.offeringLabel.trim()) throw new Error('Every new Course Offering needs a label.')
      const offeringId = await ensureOffering(supabase, batch)
      if (!batch.offeringId) createdOfferings += 1
      const groupId = await ensureGroup(supabase, batch, offeringId)

      for (const session of batch.sessions) {
        if (!session.recordingUrl?.trim()) continue
        const payload = {
          course_id: batch.courseId,
          offering_id: offeringId,
          group_id: groupId,
          code: session.code.trim() || null,
          title: session.title.trim() || session.code.trim() || 'Class',
          session_type: validSessionType(session.sessionType),
          session_date: session.sessionDate?.trim() || null,
          starts_at: null,
          ends_at: null,
          source_timezone: batch.location?.toLowerCase().includes('taiwan') ? 'Asia/Taipei' : null,
          recording_url: session.recordingUrl.trim(),
          video_provider: 'youtube',
          status: validStatus(session.status),
          sort_order: Math.max(0, Number(session.sortOrder) || 0),
          updated_at: new Date().toISOString(),
        }

        let sessionId = session.sessionId?.trim() || null
        if (sessionId) {
          const { error } = await supabase.from('sessions').update(payload).eq('id', sessionId).eq('offering_id', offeringId)
          if (error) throw new Error(error.message)
          updatedSessions += 1
        } else {
          const slugSeed = session.code || session.title || `session-${session.sortOrder + 1}`
          const { data, error } = await supabase.from('sessions').insert({
            ...payload,
            slug: await uniqueSessionSlug(supabase, batch.courseId, offeringId, groupId, slugSeed),
            created_at: new Date().toISOString(),
          }).select('id').single()
          if (error || !data) throw new Error(error?.message ?? 'Could not create session.')
          sessionId = data.id
          createdSessions += 1
        }

        await replaceTeachers(supabase, sessionId, session.teacherIds)
      }

      await savePlaylist(supabase, offeringId, batch.playlistTitle, batch.playlistUrl)
      revalidatePath(`/admin/offerings/${offeringId}`)
      revalidatePath(`/admin/offerings/${offeringId}/review`)
    }

    revalidatePath('/admin')
    revalidatePath('/admin/courses')
    revalidatePath('/courses')
    revalidatePath('/', 'layout')
    return {
      ok: true,
      message: `Imported ${createdSessions} new session${createdSessions === 1 ? '' : 's'}${updatedSessions ? ` and updated ${updatedSessions}` : ''}${createdOfferings ? ` across ${createdOfferings} new Course Offering${createdOfferings === 1 ? '' : 's'}` : ''}.`,
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Archive import failed.' }
  }
}
