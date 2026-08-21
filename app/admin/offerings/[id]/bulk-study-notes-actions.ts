'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const STUDY_NOTES_DISCLAIMER = 'These study notes were created from the class with the assistance of AI and are provided as a study aid. They may simplify or omit parts of the teaching. Please refer to the recording and transcript for the complete class.'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return supabase
}

export async function importStudyNotesDraft(
  offeringId: string,
  sessionId: string,
  sourceFileName: string,
  content: string,
) {
  const supabase = await requireAdmin()
  const cleaned = content.trim()
  if (!cleaned) throw new Error('No Study Notes content was found in this file.')

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('offering_id', offeringId)
    .maybeSingle()

  if (sessionError) throw new Error(sessionError.message)
  if (!session) throw new Error('The selected session does not belong to this Course Offering.')

  const { data: existing, error: existingError } = await supabase
    .from('study_notes')
    .select('id, status')
    .eq('session_id', sessionId)
    .eq('language_code', 'en')
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing) {
    return { ok: false, skipped: true, message: `Skipped because this session already has ${existing.status} Study Notes.` }
  }

  const { error } = await supabase.from('study_notes').insert({
    session_id: sessionId,
    language_code: 'en',
    title: 'Study Notes',
    summary: null,
    content_markdown: cleaned,
    disclaimer: STUDY_NOTES_DISCLAIMER,
    source_file_name: sourceFileName,
    status: 'draft',
    updated_at: new Date().toISOString(),
  })

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath(`/admin/offerings/${offeringId}`)
  revalidatePath(`/admin/offerings/${offeringId}/review`)
  revalidatePath('/', 'layout')

  return { ok: true, skipped: false, message: 'Imported as Draft.' }
}
