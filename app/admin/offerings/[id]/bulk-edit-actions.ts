'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SESSION_TYPES = ['class', 'meditation', 'review', 'qna', 'vows', 'other']
const STATUSES = ['draft', 'published', 'archived']

async function requireAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return supabase
}

export type BulkEditSessionRow = {
  id: string
  code: string
  title: string
  sessionType: string
  sessionDate: string
  recordingUrl: string
  status: string
  sortOrder: number
  teacherIds: string[]
}

export async function loadBulkEditSessions(offeringId: string) {
  const supabase = await requireAdmin()
  const [{ data: offering, error: offeringError }, { data: sessions, error: sessionError }, { data: teachers, error: teacherError }] = await Promise.all([
    supabase.from('course_offerings').select('id, label').eq('id', offeringId).single(),
    supabase.from('sessions').select('id, code, title, session_type, session_date, recording_url, status, sort_order, session_teachers(teacher_id)').eq('offering_id', offeringId).order('sort_order'),
    supabase.from('teachers').select('id, full_name').eq('active', true).order('full_name'),
  ])
  if (offeringError || !offering) throw new Error(offeringError?.message ?? 'Course Offering not found.')
  if (sessionError) throw new Error(sessionError.message)
  if (teacherError) throw new Error(teacherError.message)
  return {
    offeringLabel: offering.label,
    teachers: teachers ?? [],
    rows: (sessions ?? []).map((session: any) => ({
      id: session.id,
      code: session.code ?? '',
      title: session.title,
      sessionType: session.session_type,
      sessionDate: session.session_date ?? '',
      recordingUrl: session.recording_url ?? '',
      status: session.status,
      sortOrder: session.sort_order,
      teacherIds: (session.session_teachers ?? []).map((item: any) => item.teacher_id).filter(Boolean),
    })) as BulkEditSessionRow[],
  }
}

export async function saveBulkEditSessions(offeringId: string, rows: BulkEditSessionRow[]) {
  const supabase = await requireAdmin()
  if (!Array.isArray(rows) || !rows.length) return { ok: true, message: 'No sessions to update.' }
  try {
    const ids = rows.map((row) => row.id)
    const { data: owned, error: ownershipError } = await supabase.from('sessions').select('id').eq('offering_id', offeringId).in('id', ids)
    if (ownershipError) throw new Error(ownershipError.message)
    const ownedIds = new Set((owned ?? []).map((row) => row.id))
    if (ownedIds.size !== new Set(ids).size) throw new Error('One or more sessions do not belong to this Course Offering.')

    for (const row of rows) {
      if (!row.title.trim()) throw new Error('Every session needs a title.')
      if (!SESSION_TYPES.includes(row.sessionType)) throw new Error(`Invalid session type for ${row.title}.`)
      if (!STATUSES.includes(row.status)) throw new Error(`Invalid status for ${row.title}.`)
      const { error } = await supabase.from('sessions').update({
        code: row.code.trim() || null,
        title: row.title.trim(),
        session_type: row.sessionType,
        session_date: row.sessionDate || null,
        recording_url: row.recordingUrl.trim() || null,
        status: row.status,
        sort_order: Math.max(0, Number(row.sortOrder) || 0),
        updated_at: new Date().toISOString(),
      }).eq('id', row.id).eq('offering_id', offeringId)
      if (error) throw new Error(error.message)

      const { error: deleteError } = await supabase.from('session_teachers').delete().eq('session_id', row.id)
      if (deleteError) throw new Error(deleteError.message)
      const teacherIds = Array.from(new Set(row.teacherIds.filter(Boolean)))
      if (teacherIds.length) {
        const { error: insertError } = await supabase.from('session_teachers').insert(teacherIds.map((teacherId, index) => ({ session_id: row.id, teacher_id: teacherId, sort_order: index })))
        if (insertError) throw new Error(insertError.message)
      }
    }

    revalidatePath('/admin')
    revalidatePath(`/admin/offerings/${offeringId}`)
    revalidatePath(`/admin/offerings/${offeringId}/review`)
    revalidatePath('/', 'layout')
    return { ok: true, message: `${rows.length} session${rows.length === 1 ? '' : 's'} updated.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Bulk update failed.' }
  }
}
