'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type PlaylistCsvRow = {
  key: string
  position: number | null
  playlistTitle: string
  playlistUrl: string
  videoTitle: string
  videoUrl: string
}

export type PlaylistSessionOption = {
  id: string
  code: string | null
  title: string
  sessionType: string
  sortOrder: number
  teacherNames: string[]
  recordingUrl: string | null
}

export type PlaylistPreparedRow = PlaylistCsvRow & {
  sessionId: string
  matchNote: string
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

function classNumber(title: string) {
  const match = title.match(/\bclass\s*0*(\d{1,2})\b/i)
  return match ? Number(match[1]) : null
}

function meditationNumber(title: string) {
  const match = title.match(/\bmeditation\s*0*(\d{1,2})\b/i)
  return match ? Number(match[1]) : null
}

function revalidateOffering(offeringId: string, courseSlug?: string | null, offeringSlug?: string | null) {
  revalidatePath('/admin')
  revalidatePath(`/admin/offerings/${offeringId}`)
  revalidatePath(`/admin/offerings/${offeringId}/review`)
  if (courseSlug && offeringSlug) revalidatePath(`/courses/${courseSlug}/${offeringSlug}`)
  revalidatePath('/', 'layout')
}

export async function preparePlaylistCsvImport(offeringId: string, rows: PlaylistCsvRow[]) {
  const supabase = await requireAdmin()
  const { data, error } = await supabase
    .from('sessions')
    .select('id, code, title, session_type, sort_order, recording_url, session_teachers(teachers(full_name))')
    .eq('offering_id', offeringId)
    .neq('status', 'archived')
    .order('sort_order')

  if (error) throw new Error(error.message)

  const sessions: PlaylistSessionOption[] = (data ?? []).map((session: any) => ({
    id: session.id,
    code: session.code,
    title: session.title,
    sessionType: session.session_type,
    sortOrder: session.sort_order ?? 0,
    teacherNames: (session.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean),
    recordingUrl: session.recording_url,
  }))

  const byCode = new Map(sessions.filter((session) => session.code).map((session) => [session.code!.toUpperCase(), session]))
  const meditationSessions = sessions.filter((session) => session.sessionType === 'meditation').sort((a, b) => a.sortOrder - b.sortOrder)
  const usedMeditations = new Set<string>()

  // YouTube playlist exports number Position from newest/last entry at 0. Sorting descending
  // reconstructs the teaching order for the user's export format (C1, M1, C2, ...).
  const chronologicalRows = [...rows].sort((a, b) => {
    if (a.position == null && b.position == null) return 0
    if (a.position == null) return 1
    if (b.position == null) return -1
    return b.position - a.position
  })

  const preparedByKey = new Map<string, PlaylistPreparedRow>()
  for (const row of chronologicalRows) {
    const explicitClass = classNumber(row.videoTitle)
    if (explicitClass != null) {
      const target = byCode.get(`C${explicitClass}`)
      preparedByKey.set(row.key, {
        ...row,
        sessionId: target?.id ?? '',
        matchNote: target ? `Matched by Class ${explicitClass}.` : `No C${explicitClass} session exists in this Course Offering.`,
      })
      continue
    }

    const explicitMeditation = meditationNumber(row.videoTitle)
    if (explicitMeditation != null) {
      const target = byCode.get(`M${explicitMeditation}`)
      if (target) usedMeditations.add(target.id)
      preparedByKey.set(row.key, {
        ...row,
        sessionId: target?.id ?? '',
        matchNote: target ? `Matched by Meditation ${explicitMeditation}.` : `No M${explicitMeditation} session exists in this Course Offering.`,
      })
      continue
    }

    if (/\bmeditation\b/i.test(row.videoTitle)) {
      const target = meditationSessions.find((session) => !usedMeditations.has(session.id))
      if (target) usedMeditations.add(target.id)
      preparedByKey.set(row.key, {
        ...row,
        sessionId: target?.id ?? '',
        matchNote: target ? `Matched to ${target.code ?? target.title} by playlist teaching order.` : 'No unmatched meditation session remains.',
      })
      continue
    }

    preparedByKey.set(row.key, { ...row, sessionId: '', matchNote: 'Choose the matching session.' })
  }

  return {
    sessions,
    rows: rows.map((row) => preparedByKey.get(row.key) ?? { ...row, sessionId: '', matchNote: 'Choose the matching session.' }),
  }
}

export async function applyPlaylistCsvImport(
  offeringId: string,
  rows: Array<{ sessionId: string; videoUrl: string }>,
  playlist: { url: string; title: string },
) {
  const supabase = await requireAdmin()

  const { data: offering, error: offeringError } = await supabase
    .from('course_offerings')
    .select('id, slug, courses(slug)')
    .eq('id', offeringId)
    .single()
  if (offeringError || !offering) throw new Error(offeringError?.message ?? 'Course Offering not found.')

  const { data: sessionRows, error: sessionError } = await supabase
    .from('sessions')
    .select('id')
    .eq('offering_id', offeringId)
  if (sessionError) throw new Error(sessionError.message)
  const allowedIds = new Set((sessionRows ?? []).map((row: any) => row.id))

  let updated = 0
  const used = new Set<string>()
  for (const row of rows) {
    const sessionId = row.sessionId?.trim()
    const videoUrl = row.videoUrl?.trim()
    if (!sessionId || !videoUrl || !allowedIds.has(sessionId) || used.has(sessionId)) continue
    used.add(sessionId)
    const { error } = await supabase.from('sessions').update({ recording_url: videoUrl, updated_at: new Date().toISOString() }).eq('id', sessionId).eq('offering_id', offeringId)
    if (error) throw new Error(error.message)
    updated += 1
  }

  let playlistSaved = false
  const playlistUrl = playlist.url?.trim()
  if (playlistUrl) {
    const { data: existing, error: existingError } = await supabase
      .from('materials')
      .select('id')
      .eq('offering_id', offeringId)
      .is('session_id', null)
      .eq('material_type', 'video')
      .ilike('title', '%playlist%')
      .limit(1)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)

    if (existing) {
      const { error } = await supabase.from('materials').update({
        title: 'Course recordings playlist',
        url: playlistUrl,
        status: 'published',
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id)
      if (error) throw new Error(error.message)
    } else {
      const { data: highest, error: highestError } = await supabase
        .from('materials')
        .select('sort_order')
        .eq('offering_id', offeringId)
        .is('session_id', null)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (highestError) throw new Error(highestError.message)
      const { error } = await supabase.from('materials').insert({
        offering_id: offeringId,
        session_id: null,
        course_id: null,
        material_type: 'video',
        title: 'Course recordings playlist',
        url: playlistUrl,
        mime_type: 'text/html',
        status: 'published',
        sort_order: (highest?.sort_order ?? -1) + 1,
      })
      if (error) throw new Error(error.message)
    }
    playlistSaved = true
  }

  const course = offering.courses as any
  revalidateOffering(offeringId, course?.slug ?? null, offering.slug)
  return { updated, playlistSaved }
}
