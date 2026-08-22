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
  createNew: boolean
  matchNote: string
  proposedCode: string
  proposedTitle: string
  proposedType: 'class' | 'meditation'
}

type PreparedResult =
  | { ok: true; sessions: PlaylistSessionOption[]; rows: PlaylistPreparedRow[]; emptyOffering: boolean }
  | { ok: false; error: string; sessions: PlaylistSessionOption[]; rows: PlaylistPreparedRow[]; emptyOffering: boolean }

type ApplyRow = {
  sessionId: string
  createNew: boolean
  videoUrl: string
  videoTitle: string
  proposedCode: string
  proposedTitle: string
  proposedType: 'class' | 'meditation'
  position: number | null
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'session'
}

function chronological<T extends { position: number | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (a.position == null && b.position == null) return 0
    if (a.position == null) return 1
    if (b.position == null) return -1
    return b.position - a.position
  })
}

function revalidateOffering(offeringId: string, courseSlug?: string | null, offeringSlug?: string | null) {
  revalidatePath('/admin')
  revalidatePath(`/admin/offerings/${offeringId}`)
  revalidatePath(`/admin/offerings/${offeringId}/review`)
  if (courseSlug && offeringSlug) revalidatePath(`/courses/${courseSlug}/${offeringSlug}`)
  revalidatePath('/', 'layout')
}

export async function preparePlaylistCsvImport(offeringId: string, rows: PlaylistCsvRow[]): Promise<PreparedResult> {
  try {
    const supabase = await requireAdmin()
    const { data, error } = await supabase
      .from('sessions')
      .select('id, code, title, session_type, sort_order, recording_url, session_teachers(teachers(full_name))')
      .eq('offering_id', offeringId)
      .neq('status', 'archived')
      .order('sort_order')

    if (error) return { ok: false, error: error.message, sessions: [], rows: [], emptyOffering: true }

    const sessions: PlaylistSessionOption[] = (data ?? []).map((session: any) => ({
      id: session.id,
      code: session.code,
      title: session.title,
      sessionType: session.session_type,
      sortOrder: session.sort_order ?? 0,
      teacherNames: (session.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean),
      recordingUrl: session.recording_url,
    }))

    const emptyOffering = sessions.length === 0
    const byCode = new Map(sessions.filter((session) => session.code).map((session) => [session.code!.toUpperCase(), session]))
    const meditationSessions = sessions.filter((session) => session.sessionType === 'meditation').sort((a, b) => a.sortOrder - b.sortOrder)
    const usedMeditations = new Set<string>()
    let inferredMeditation = 0
    let inferredClass = 0

    const preparedByKey = new Map<string, PlaylistPreparedRow>()
    for (const row of chronological(rows)) {
      const explicitClass = classNumber(row.videoTitle)
      const explicitMeditation = meditationNumber(row.videoTitle)
      const looksLikeMeditation = explicitMeditation != null || /\bmeditation\b/i.test(row.videoTitle)

      let proposedType: 'class' | 'meditation' = looksLikeMeditation ? 'meditation' : 'class'
      let proposedCode = ''
      if (explicitClass != null) {
        inferredClass = Math.max(inferredClass, explicitClass)
        proposedCode = `C${explicitClass}`
      } else if (explicitMeditation != null) {
        inferredMeditation = Math.max(inferredMeditation, explicitMeditation)
        proposedCode = `M${explicitMeditation}`
      } else if (looksLikeMeditation) {
        inferredMeditation += 1
        proposedCode = `M${inferredMeditation}`
      } else {
        inferredClass += 1
        proposedCode = `C${inferredClass}`
      }

      const proposedTitle = row.videoTitle.trim() || `${proposedType === 'meditation' ? 'Meditation' : 'Class'} ${proposedCode.replace(/^[CM]/, '')}`
      let target: PlaylistSessionOption | undefined
      let matchNote = ''

      if (explicitClass != null) {
        target = byCode.get(`C${explicitClass}`)
        matchNote = target ? `Matched by Class ${explicitClass}.` : `No C${explicitClass} session exists yet.`
      } else if (explicitMeditation != null) {
        target = byCode.get(`M${explicitMeditation}`)
        if (target) usedMeditations.add(target.id)
        matchNote = target ? `Matched by Meditation ${explicitMeditation}.` : `No M${explicitMeditation} session exists yet.`
      } else if (looksLikeMeditation && sessions.length) {
        target = meditationSessions.find((session) => !usedMeditations.has(session.id))
        if (target) usedMeditations.add(target.id)
        matchNote = target ? `Matched to ${target.code ?? target.title} by playlist teaching order.` : 'No unmatched meditation session remains.'
      } else if (!sessions.length) {
        matchNote = `Will create ${proposedCode} as a Draft ${proposedType}.`
      } else {
        matchNote = 'Choose an existing session or create a new one.'
      }

      preparedByKey.set(row.key, {
        ...row,
        sessionId: target?.id ?? '',
        createNew: !target && emptyOffering,
        matchNote,
        proposedCode,
        proposedTitle,
        proposedType,
      })
    }

    return {
      ok: true,
      sessions,
      rows: rows.map((row) => preparedByKey.get(row.key) ?? {
        ...row,
        sessionId: '',
        createNew: emptyOffering,
        matchNote: emptyOffering ? 'Will create a Draft session.' : 'Choose an existing session or create a new one.',
        proposedCode: '',
        proposedTitle: row.videoTitle || 'Class',
        proposedType: 'class',
      }),
      emptyOffering,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not prepare the recording import.',
      sessions: [],
      rows: [],
      emptyOffering: true,
    }
  }
}

export async function applyPlaylistCsvImport(
  offeringId: string,
  rows: ApplyRow[],
  playlist: { url: string; title: string },
) {
  try {
    const supabase = await requireAdmin()

    const { data: offering, error: offeringError } = await supabase
      .from('course_offerings')
      .select('id, slug, course_id, courses(slug)')
      .eq('id', offeringId)
      .single()
    if (offeringError || !offering) return { ok: false as const, error: offeringError?.message ?? 'Course Offering not found.', updated: 0, created: 0, playlistSaved: false }

    const { data: sessionRows, error: sessionError } = await supabase
      .from('sessions')
      .select('id, code, slug, sort_order')
      .eq('offering_id', offeringId)
      .order('sort_order')
    if (sessionError) return { ok: false as const, error: sessionError.message, updated: 0, created: 0, playlistSaved: false }

    const allowedIds = new Set((sessionRows ?? []).map((row: any) => row.id))
    const usedCodes = new Set((sessionRows ?? []).map((row: any) => String(row.code ?? '').toUpperCase()).filter(Boolean))
    const usedSlugs = new Set((sessionRows ?? []).map((row: any) => String(row.slug)))
    let nextSort = (sessionRows ?? []).reduce((max: number, row: any) => Math.max(max, Number(row.sort_order ?? 0)), -10) + 10
    let updated = 0
    let created = 0
    const usedTargets = new Set<string>()

    function uniqueSlug(baseValue: string) {
      const base = slugify(baseValue)
      let candidate = base
      let suffix = 2
      while (usedSlugs.has(candidate)) candidate = `${base}-${suffix++}`
      usedSlugs.add(candidate)
      return candidate
    }

    for (const row of chronological(rows)) {
      const videoUrl = row.videoUrl?.trim()
      if (!videoUrl) continue
      const sessionId = row.sessionId?.trim()

      if (sessionId && allowedIds.has(sessionId) && !usedTargets.has(sessionId)) {
        usedTargets.add(sessionId)
        const { error } = await supabase
          .from('sessions')
          .update({ recording_url: videoUrl, updated_at: new Date().toISOString() })
          .eq('id', sessionId)
          .eq('offering_id', offeringId)
        if (error) return { ok: false as const, error: error.message, updated, created, playlistSaved: false }
        updated += 1
        continue
      }

      if (!row.createNew) continue

      let code = row.proposedCode?.trim().toUpperCase()
      if (!code || usedCodes.has(code)) {
        const prefix = row.proposedType === 'meditation' ? 'M' : 'C'
        let number = 1
        while (usedCodes.has(`${prefix}${number}`)) number += 1
        code = `${prefix}${number}`
      }
      usedCodes.add(code)

      const title = row.proposedTitle?.trim() || row.videoTitle?.trim() || `${row.proposedType === 'meditation' ? 'Meditation' : 'Class'} ${code.replace(/^[CM]/, '')}`
      const { data: createdSession, error } = await supabase
        .from('sessions')
        .insert({
          course_id: offering.course_id,
          offering_id: offeringId,
          slug: uniqueSlug(`${code}-${title}`),
          code,
          title,
          session_type: row.proposedType === 'meditation' ? 'meditation' : 'class',
          recording_url: videoUrl,
          status: 'draft',
          required_for_completion: false,
          sort_order: nextSort,
        })
        .select('id')
        .single()
      if (error || !createdSession) return { ok: false as const, error: error?.message ?? `Could not create ${code}.`, updated, created, playlistSaved: false }
      allowedIds.add(createdSession.id)
      nextSort += 10
      created += 1
    }

    let playlistSaved = false
    const playlistUrl = playlist.url?.trim()
    if (playlistUrl) {
      const { data: existing, error: existingError } = await supabase
        .from('materials')
        .select('id, status')
        .eq('offering_id', offeringId)
        .is('session_id', null)
        .eq('material_type', 'video')
        .ilike('title', '%playlist%')
        .limit(1)
        .maybeSingle()
      if (existingError) return { ok: false as const, error: existingError.message, updated, created, playlistSaved: false }

      if (existing) {
        const { error } = await supabase.from('materials').update({
          title: 'Course recordings playlist',
          url: playlistUrl,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
        if (error) return { ok: false as const, error: error.message, updated, created, playlistSaved: false }
      } else {
        const { data: highest, error: highestError } = await supabase
          .from('materials')
          .select('sort_order')
          .eq('offering_id', offeringId)
          .is('session_id', null)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (highestError) return { ok: false as const, error: highestError.message, updated, created, playlistSaved: false }
        const { error } = await supabase.from('materials').insert({
          offering_id: offeringId,
          session_id: null,
          course_id: null,
          material_type: 'video',
          title: 'Course recordings playlist',
          url: playlistUrl,
          mime_type: 'text/html',
          status: 'draft',
          sort_order: (highest?.sort_order ?? -1) + 1,
        })
        if (error) return { ok: false as const, error: error.message, updated, created, playlistSaved: false }
      }
      playlistSaved = true
    }

    const course = offering.courses as any
    revalidateOffering(offeringId, course?.slug ?? null, offering.slug)
    return { ok: true as const, updated, created, playlistSaved }
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Recording import failed.',
      updated: 0,
      created: 0,
      playlistSaved: false,
    }
  }
}
