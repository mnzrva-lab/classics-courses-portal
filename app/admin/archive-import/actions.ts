'use server'

import { randomUUID } from 'node:crypto'
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

async function reusableOfferingId(supabase: Awaited<ReturnType<typeof createClient>>, batch: ArchiveBatchInput) {
  const playlistUrl = batch.playlistUrl?.trim()
  if (playlistUrl) {
    const { data: marker } = await supabase
      .from('materials')
      .select('offering_id, created_at')
      .eq('url', playlistUrl)
      .is('session_id', null)
      .not('offering_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (marker?.offering_id) {
      const { data: offering } = await supabase.from('course_offerings').select('id, course_id').eq('id', marker.offering_id).maybeSingle()
      if (offering?.course_id === batch.courseId) return String(offering.id)
    }
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let query = supabase
    .from('course_offerings')
    .select('id')
    .eq('course_id', batch.courseId)
    .eq('label', batch.offeringLabel.trim())
    .eq('status', 'draft')
    .gte('created_at', cutoff)

  if (batch.year == null) query = query.is('year', null)
  else query = query.eq('year', batch.year)

  const location = batch.location?.trim() || null
  if (location) query = query.eq('location', location)
  else query = query.is('location', null)

  const { data } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data?.id ? String(data.id) : null
}

async function ensureOffering(supabase: Awaited<ReturnType<typeof createClient>>, batch: ArchiveBatchInput) {
  if (batch.offeringId) {
    const { data, error } = await supabase.from('course_offerings').select('id, course_id').eq('id', batch.offeringId).single()
    if (error || !data) throw new Error('Selected Course Offering was not found.')
    if (data.course_id !== batch.courseId) throw new Error('Selected Course Offering belongs to a different course.')
    return { id: String(data.id), created: false }
  }

  const reusableId = await reusableOfferingId(supabase, batch)
  if (reusableId) return { id: reusableId, created: false }

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
  return { id: String(data.id), created: true }
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
  if (existing?.id) return String(existing.id)

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
  return String(data.id)
}

function reserveSlug(used: Set<string>, proposed: string) {
  const base = slugify(proposed, 'session')
  let slug = base
  let suffix = 2
  while (used.has(slug)) slug = `${base}-${suffix++}`
  used.add(slug)
  return slug
}

async function savePlaylist(supabase: Awaited<ReturnType<typeof createClient>>, offeringId: string, title: string | null | undefined, url: string | null | undefined) {
  if (!url?.trim()) return
  const cleanUrl = url.trim()
  const { data: existing } = await supabase.from('materials').select('id').eq('offering_id', offeringId).is('session_id', null).eq('url', cleanUrl).limit(1).maybeSingle()
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

async function syncOfferingDateRange(supabase: Awaited<ReturnType<typeof createClient>>, offeringId: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select('session_date')
    .eq('offering_id', offeringId)
    .not('session_date', 'is', null)
    .order('session_date', { ascending: true })
  if (error) throw new Error(error.message)
  const dates = (data ?? []).map((row) => row.session_date).filter(Boolean) as string[]
  if (!dates.length) return
  const { error: updateError } = await supabase.from('course_offerings').update({
    starts_on: dates[0],
    ends_on: dates[dates.length - 1],
    updated_at: new Date().toISOString(),
  }).eq('id', offeringId)
  if (updateError) throw new Error(updateError.message)
}

async function importBatch(supabase: Awaited<ReturnType<typeof createClient>>, batch: ArchiveBatchInput) {
  if (!batch.courseId) throw new Error('Every CSV needs a course assignment.')
  if (!batch.offeringId && !batch.offeringLabel.trim()) throw new Error('Every new Course Offering needs a label.')

  const incoming = batch.sessions.filter((session) => session.recordingUrl?.trim()).map((session) => ({
    ...session,
    sessionType: validSessionType(session.sessionType),
    status: validStatus(session.status),
  }))
  if (!incoming.length) throw new Error('This CSV has no selected recordings to import.')

  const offering = await ensureOffering(supabase, { ...batch, sessions: incoming })
  const offeringId = offering.id
  const groupId = await ensureGroup(supabase, { ...batch, sessions: incoming }, offeringId)

  // Save the playlist marker before the session work. If a request is interrupted,
  // a retry can reliably find and reuse the same Course Offering.
  await savePlaylist(supabase, offeringId, batch.playlistTitle, batch.playlistUrl)

  const { data: existingRows, error: existingError } = await supabase
    .from('sessions')
    .select('id, code, recording_url, slug')
    .eq('offering_id', offeringId)
  if (existingError) throw new Error(existingError.message)

  const existing = existingRows ?? []
  const byRecording = new Map(existing.filter((row) => row.recording_url).map((row) => [String(row.recording_url), String(row.id)]))
  const byCode = new Map(existing.filter((row) => row.code).map((row) => [String(row.code).toLowerCase(), String(row.id)]))
  const usedSlugs = new Set(existing.map((row) => String(row.slug)))
  const now = new Date().toISOString()

  const newRows: any[] = []
  const updates: Array<{ id: string; payload: any }> = []
  const teacherAssignments: Array<{ sessionId: string; teacherIds: string[] }> = []

  for (const session of incoming) {
    const cleanRecordingUrl = session.recordingUrl.trim()
    const cleanCode = session.code.trim()
    const resolvedId = session.sessionId?.trim()
      || byRecording.get(cleanRecordingUrl)
      || (cleanCode ? byCode.get(cleanCode.toLowerCase()) : null)
      || null

    const payload = {
      course_id: batch.courseId,
      offering_id: offeringId,
      group_id: groupId,
      code: cleanCode || null,
      title: session.title.trim() || cleanCode || 'Class',
      session_type: session.sessionType,
      session_date: session.sessionDate?.trim() || null,
      starts_at: null,
      ends_at: null,
      source_timezone: batch.location?.toLowerCase().includes('taiwan') ? 'Asia/Taipei' : null,
      recording_url: cleanRecordingUrl,
      video_provider: 'youtube',
      status: session.status,
      sort_order: Math.max(0, Number(session.sortOrder) || 0),
      updated_at: now,
    }

    if (resolvedId) {
      updates.push({ id: resolvedId, payload })
      teacherAssignments.push({ sessionId: resolvedId, teacherIds: session.teacherIds })
      continue
    }

    const id = randomUUID()
    const slugSeed = cleanCode || session.title || `session-${session.sortOrder + 1}`
    newRows.push({
      id,
      ...payload,
      slug: reserveSlug(usedSlugs, slugSeed),
      created_at: now,
    })
    teacherAssignments.push({ sessionId: id, teacherIds: session.teacherIds })
  }

  if (newRows.length) {
    const { error } = await supabase.from('sessions').insert(newRows)
    if (error) throw new Error(error.message)
  }

  for (const update of updates) {
    const { error } = await supabase.from('sessions').update(update.payload).eq('id', update.id).eq('offering_id', offeringId)
    if (error) throw new Error(error.message)
  }

  const affectedIds = teacherAssignments.map((item) => item.sessionId)
  if (affectedIds.length) {
    const { error: deleteError } = await supabase.from('session_teachers').delete().in('session_id', affectedIds)
    if (deleteError) throw new Error(deleteError.message)

    const teacherRows = teacherAssignments.flatMap((item) => Array.from(new Set(item.teacherIds.filter(Boolean))).map((teacherId, index) => ({
      session_id: item.sessionId,
      teacher_id: teacherId,
      sort_order: index,
    })))
    if (teacherRows.length) {
      const { error: teacherError } = await supabase.from('session_teachers').insert(teacherRows)
      if (teacherError) throw new Error(teacherError.message)
    }
  }

  await syncOfferingDateRange(supabase, offeringId)
  revalidatePath(`/admin/offerings/${offeringId}`)
  revalidatePath(`/admin/offerings/${offeringId}/review`)

  return {
    offeringId,
    createdOffering: offering.created,
    createdSessions: newRows.length,
    updatedSessions: updates.length,
  }
}

export async function applyArchiveBatches(batches: ArchiveBatchInput[]) {
  const supabase = await requireAdmin()
  if (!Array.isArray(batches) || !batches.length) return { ok: false, message: 'Choose at least one CSV to import.' }

  let createdOfferings = 0
  let createdSessions = 0
  let updatedSessions = 0

  try {
    for (const batch of batches) {
      const result = await importBatch(supabase, batch)
      if (result.createdOffering) createdOfferings += 1
      createdSessions += result.createdSessions
      updatedSessions += result.updatedSessions
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
