'use server'

import { createClient } from '@/lib/supabase/server'
import { isValidTimeZone, zonedLocalToIso } from '@/lib/timezone'

const SESSION_TYPES = ['class', 'meditation', 'review', 'qna', 'vows', 'other'] as const

type SessionImportRow = {
  code?: string
  title: string
  type?: string
  date?: string
  start?: string
  end?: string
  timezone?: string
  teacher?: string
  section?: string
  recording_url?: string
  audio_url?: string
  required?: string | boolean
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) return { ok: false as const, message: 'Sign in required.' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') return { ok: false as const, message: 'Admin access required.' }
  return { ok: true as const, supabase }
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'session'
}

function boolValue(value: unknown) {
  if (typeof value === 'boolean') return value
  const normalized = clean(value).toLowerCase()
  if (!normalized) return true
  return !['0', 'false', 'no', 'n'].includes(normalized)
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function validTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

export async function importSessionScaffold(
  offeringId: string,
  courseId: string,
  defaultTimezone: string,
  row: SessionImportRow,
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth
  const supabase = auth.supabase

  const title = clean(row.title)
  const code = clean(row.code) || null
  const sessionType = clean(row.type).toLowerCase() || 'class'
  const date = clean(row.date) || null
  const start = clean(row.start) || null
  const end = clean(row.end) || null
  const timezone = clean(row.timezone) || defaultTimezone || 'America/Phoenix'
  const recordingUrl = clean(row.recording_url) || null
  const audioUrl = clean(row.audio_url) || null

  if (!title) return { ok: false as const, message: 'Title is required.' }
  if (!SESSION_TYPES.includes(sessionType as (typeof SESSION_TYPES)[number])) {
    return { ok: false as const, message: `Unknown type “${sessionType}”. Use class, meditation, review, qna, vows, or other.` }
  }
  if (date && !validDate(date)) return { ok: false as const, message: 'Date must use YYYY-MM-DD.' }
  if (start && !validTime(start)) return { ok: false as const, message: 'Start time must use HH:MM.' }
  if (end && !validTime(end)) return { ok: false as const, message: 'End time must use HH:MM.' }
  if ((start || end) && !date) return { ok: false as const, message: 'A date is required when start or end time is present.' }
  if (!isValidTimeZone(timezone)) return { ok: false as const, message: `Unknown timezone “${timezone}”. Use an IANA timezone such as America/Phoenix.` }

  const { data: offering, error: offeringError } = await supabase
    .from('course_offerings')
    .select('id, course_id')
    .eq('id', offeringId)
    .eq('course_id', courseId)
    .maybeSingle()
  if (offeringError) return { ok: false as const, message: offeringError.message }
  if (!offering) return { ok: false as const, message: 'Course Offering does not match this course.' }

  const { data: existingSessions, error: existingError } = await supabase
    .from('sessions')
    .select('id, code, title, slug, sort_order')
    .eq('offering_id', offeringId)
  if (existingError) return { ok: false as const, message: existingError.message }

  const duplicate = (existingSessions ?? []).find((session) =>
    (code && session.code?.toLowerCase() === code.toLowerCase()) ||
    session.title.trim().toLowerCase() === title.toLowerCase()
  )
  if (duplicate) return { ok: false as const, message: `Skipped: ${duplicate.code ? `${duplicate.code} · ` : ''}${duplicate.title} already exists.` }

  let groupId: string | null = null
  const requestedSection = clean(row.section)
  if (requestedSection) {
    const { data: groups, error: groupError } = await supabase
      .from('content_groups')
      .select('id, label, title')
      .eq('offering_id', offeringId)
      .neq('status', 'archived')
    if (groupError) return { ok: false as const, message: groupError.message }

    const normalized = requestedSection.toLowerCase()
    const matched = (groups ?? []).find((group) =>
      group.label.trim().toLowerCase() === normalized ||
      (group.title ?? '').trim().toLowerCase() === normalized
    )
    if (!matched) return { ok: false as const, message: `Section “${requestedSection}” was not found in this Course Offering.` }
    groupId = matched.id
  }

  const requestedTeacherNames = clean(row.teacher)
    .split('|')
    .map((name) => name.trim())
    .filter(Boolean)

  let teacherIds: string[] = []
  if (requestedTeacherNames.length) {
    const { data: teachers, error: teacherError } = await supabase.from('teachers').select('id, full_name')
    if (teacherError) return { ok: false as const, message: teacherError.message }
    const teacherMap = new Map((teachers ?? []).map((teacher) => [teacher.full_name.trim().toLowerCase(), teacher.id]))
    const missing = requestedTeacherNames.filter((name) => !teacherMap.has(name.toLowerCase()))
    if (missing.length) return { ok: false as const, message: `Teacher not found: ${missing.join(', ')}. Add the teacher in Admin first.` }
    teacherIds = requestedTeacherNames.map((name) => teacherMap.get(name.toLowerCase())!).filter(Boolean)
  }

  const startsAt = date && start ? zonedLocalToIso(date, start, timezone) : null
  const endsAt = date && end ? zonedLocalToIso(date, end, timezone) : null
  const baseSlug = slugify(code || title)
  const usedSlugs = new Set((existingSessions ?? []).map((session) => session.slug))
  let slug = baseSlug
  let suffix = 2
  while (usedSlugs.has(slug)) slug = `${baseSlug}-${suffix++}`
  const sortOrder = Math.max(0, ...(existingSessions ?? []).map((session) => session.sort_order ?? 0)) + 10

  const { data: session, error: insertError } = await supabase
    .from('sessions')
    .insert({
      course_id: courseId,
      offering_id: offeringId,
      group_id: groupId,
      slug,
      code,
      title,
      session_type: sessionType,
      session_date: date,
      starts_at: startsAt,
      ends_at: endsAt,
      source_timezone: timezone,
      recording_url: recordingUrl,
      audio_url: audioUrl,
      required_for_completion: boolValue(row.required),
      status: 'draft',
      sort_order: sortOrder,
    })
    .select('id')
    .single()
  if (insertError || !session) return { ok: false as const, message: insertError?.message ?? 'Could not create session.' }

  if (teacherIds.length) {
    const { error: linkError } = await supabase.from('session_teachers').insert(
      teacherIds.map((teacherId, index) => ({ session_id: session.id, teacher_id: teacherId, sort_order: index }))
    )
    if (linkError) {
      await supabase.from('sessions').delete().eq('id', session.id)
      return { ok: false as const, message: linkError.message }
    }
  }

  return { ok: true as const, message: `Created ${code ? `${code} · ` : ''}${title} as Draft.`, sessionId: session.id }
}
