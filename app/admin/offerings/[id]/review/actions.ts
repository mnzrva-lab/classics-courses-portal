'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return supabase
}

function validVisibility(value: string) {
  if (value !== 'draft' && value !== 'published') throw new Error('Invalid publishing status')
  return value
}

async function requireSessionInOffering(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  offeringId: string,
) {
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('offering_id', offeringId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!session) throw new Error('Session does not belong to this Course Offering')
}

function finish(offeringId: string, message: string) {
  revalidatePath('/admin')
  revalidatePath(`/admin/offerings/${offeringId}`)
  revalidatePath(`/admin/offerings/${offeringId}/review`)
  revalidatePath('/', 'layout')
  redirect(`/admin/offerings/${offeringId}/review?saved=${encodeURIComponent(message)}`)
}

export async function setSessionVisibility(
  offeringId: string,
  sessionId: string,
  nextStatus: string,
) {
  const supabase = await requireAdmin()
  const status = validVisibility(nextStatus)
  await requireSessionInOffering(supabase, sessionId, offeringId)

  const { error } = await supabase
    .from('sessions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)
  finish(offeringId, status === 'published' ? 'session-published' : 'session-draft')
}

export async function setStudyNotesVisibility(
  offeringId: string,
  sessionId: string,
  nextStatus: string,
) {
  const supabase = await requireAdmin()
  const status = validVisibility(nextStatus)
  await requireSessionInOffering(supabase, sessionId, offeringId)

  const { data: notes, error: readError } = await supabase
    .from('study_notes')
    .select('id')
    .eq('session_id', sessionId)
    .eq('language_code', 'en')
    .maybeSingle()

  if (readError) throw new Error(readError.message)
  if (!notes) throw new Error('Study Notes have not been added yet')

  const { error } = await supabase
    .from('study_notes')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', notes.id)

  if (error) throw new Error(error.message)
  finish(offeringId, status === 'published' ? 'notes-published' : 'notes-draft')
}

export async function setTranscriptVisibility(
  offeringId: string,
  sessionId: string,
  nextStatus: string,
) {
  const supabase = await requireAdmin()
  const status = validVisibility(nextStatus)
  await requireSessionInOffering(supabase, sessionId, offeringId)

  const { data: transcript, error: readError } = await supabase
    .from('transcripts')
    .select('id')
    .eq('session_id', sessionId)
    .eq('language_code', 'en')
    .maybeSingle()

  if (readError) throw new Error(readError.message)
  if (!transcript) throw new Error('Reference Transcript has not been added yet')

  const { error } = await supabase
    .from('transcripts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', transcript.id)

  if (error) throw new Error(error.message)
  finish(offeringId, status === 'published' ? 'transcript-published' : 'transcript-draft')
}

export async function setMaterialsVisibility(
  offeringId: string,
  sessionId: string,
  nextStatus: string,
) {
  const supabase = await requireAdmin()
  const status = validVisibility(nextStatus)
  await requireSessionInOffering(supabase, sessionId, offeringId)

  const sourceStatus = status === 'published' ? 'draft' : 'published'
  const { error } = await supabase
    .from('materials')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('status', sourceStatus)

  if (error) throw new Error(error.message)
  finish(offeringId, status === 'published' ? 'materials-published' : 'materials-draft')
}

export async function publishDraftContent(offeringId: string, sessionId: string) {
  const supabase = await requireAdmin()
  await requireSessionInOffering(supabase, sessionId, offeringId)
  const now = new Date().toISOString()

  const [notesResult, transcriptResult, materialsResult] = await Promise.all([
    supabase
      .from('study_notes')
      .update({ status: 'published', updated_at: now })
      .eq('session_id', sessionId)
      .eq('language_code', 'en')
      .eq('status', 'draft'),
    supabase
      .from('transcripts')
      .update({ status: 'published', updated_at: now })
      .eq('session_id', sessionId)
      .eq('language_code', 'en')
      .eq('status', 'draft'),
    supabase
      .from('materials')
      .update({ status: 'published', updated_at: now })
      .eq('session_id', sessionId)
      .eq('status', 'draft'),
  ])

  const firstError = notesResult.error ?? transcriptResult.error ?? materialsResult.error
  if (firstError) throw new Error(firstError.message)
  finish(offeringId, 'content-published')
}
