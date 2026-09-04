'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub as string | undefined
  if (!userId) redirect('/login')
  return { supabase, userId }
}

async function readSettings(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('save_notes, save_bookmarks, save_progress')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error('Could not read privacy settings.')
  return {
    saveNotes: data?.save_notes ?? true,
    saveBookmarks: data?.save_bookmarks ?? true,
    saveProgress: data?.save_progress ?? true,
  }
}

async function touchProgress(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, sessionId: string, saveProgress?: boolean) {
  const enabled = saveProgress ?? (await readSettings(supabase, userId)).saveProgress
  if (!enabled) return

  const { error } = await supabase
    .from('user_session_progress')
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        last_opened_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,session_id' }
    )

  if (error) throw new Error('Could not update study progress.')
}

export async function startSessionProgress(sessionId: string, returnPath: string) {
  const { supabase, userId } = await requireUser()
  const settings = await readSettings(supabase, userId)
  if (!settings.saveProgress) throw new Error('Progress saving is turned off in Privacy & Data.')

  await touchProgress(supabase, userId, sessionId, true)
  revalidatePath(returnPath)
  revalidatePath('/my-learning')
}

export async function toggleSessionComplete(sessionId: string, returnPath: string) {
  const { supabase, userId } = await requireUser()
  const [settings, currentResult] = await Promise.all([
    readSettings(supabase, userId),
    supabase
      .from('user_session_progress')
      .select('started_at, completed_at')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .maybeSingle(),
  ])

  if (currentResult.error) throw new Error('Could not read completion state.')
  const current = currentResult.data
  const isCompleted = Boolean(current?.completed_at)
  if (!isCompleted && !settings.saveProgress) throw new Error('Progress saving is turned off in Privacy & Data.')

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('user_session_progress')
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        started_at: current?.started_at ?? now,
        last_opened_at: now,
        completed_at: isCompleted ? null : now,
      },
      { onConflict: 'user_id,session_id' }
    )

  if (error) throw new Error(isCompleted ? 'Could not remove completion.' : 'Could not save completion.')

  revalidatePath(returnPath)
  const cleanPath = returnPath.split('?')[0]
  const parentPath = cleanPath.split('/').slice(0, -1).join('/')
  if (parentPath) revalidatePath(parentPath)
  revalidatePath('/my-learning')
}

export async function saveSessionNote(sessionId: string, returnPath: string, formData: FormData) {
  const note = String(formData.get('note') || '').trim()
  if (!note) return

  const { supabase, userId } = await requireUser()
  const settings = await readSettings(supabase, userId)
  if (!settings.saveNotes) throw new Error('Note saving is turned off in Privacy & Data.')

  const { error } = await supabase.from('student_notes').insert({
    user_id: userId,
    session_id: sessionId,
    paragraph_id: null,
    note,
  })

  if (error) throw new Error('Could not save note.')
  await touchProgress(supabase, userId, sessionId, settings.saveProgress)
  revalidatePath(returnPath)
  revalidatePath('/my-learning')
  revalidatePath('/my-notes')
}

export async function saveParagraphNote(paragraphId: string, sessionId: string, returnPath: string, formData: FormData) {
  const note = String(formData.get('note') || '').trim()
  if (!note) return

  const { supabase, userId } = await requireUser()
  const settings = await readSettings(supabase, userId)
  if (!settings.saveNotes) throw new Error('Note saving is turned off in Privacy & Data.')

  const { data: paragraph, error: paragraphError } = await supabase
    .from('transcript_paragraphs')
    .select('id, is_active, transcripts!inner(session_id)')
    .eq('id', paragraphId)
    .eq('is_active', true)
    .eq('transcripts.session_id', sessionId)
    .maybeSingle()

  if (paragraphError) throw new Error('Could not verify this transcript passage.')
  if (!paragraph) throw new Error('This transcript passage is no longer available in the current class.')

  const { error } = await supabase.from('student_notes').insert({
    user_id: userId,
    session_id: sessionId,
    paragraph_id: paragraphId,
    note,
  })

  if (error) throw new Error('Could not save passage note.')
  await touchProgress(supabase, userId, sessionId, settings.saveProgress)
  revalidatePath(returnPath)
  revalidatePath('/my-learning')
  revalidatePath('/my-notes')
}

export async function toggleSessionBookmark(sessionId: string, returnPath: string) {
  const { supabase, userId } = await requireUser()
  const [{ data: existing, error: readError }, settings] = await Promise.all([
    supabase
      .from('user_session_bookmarks')
      .select('session_id')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .maybeSingle(),
    readSettings(supabase, userId),
  ])

  if (readError) throw new Error('Could not read bookmark.')
  if (!existing && !settings.saveBookmarks) throw new Error('Bookmark saving is turned off in Privacy & Data.')

  const result = existing
    ? await supabase.from('user_session_bookmarks').delete().eq('user_id', userId).eq('session_id', sessionId)
    : await supabase.from('user_session_bookmarks').insert({ user_id: userId, session_id: sessionId })

  if (result.error) throw new Error('Could not save bookmark.')
  await touchProgress(supabase, userId, sessionId, settings.saveProgress)
  revalidatePath(returnPath)
  revalidatePath('/my-learning')
  revalidatePath('/my-notes')
}

export async function toggleParagraphBookmark(paragraphId: string, returnPath: string) {
  const { supabase, userId } = await requireUser()
  const [{ data: existing, error: readError }, settings] = await Promise.all([
    supabase
      .from('user_paragraph_bookmarks')
      .select('paragraph_id')
      .eq('user_id', userId)
      .eq('paragraph_id', paragraphId)
      .maybeSingle(),
    readSettings(supabase, userId),
  ])

  if (readError) throw new Error('Could not read bookmark.')
  if (!existing && !settings.saveBookmarks) throw new Error('Bookmark saving is turned off in Privacy & Data.')

  const result = existing
    ? await supabase.from('user_paragraph_bookmarks').delete().eq('user_id', userId).eq('paragraph_id', paragraphId)
    : await supabase.from('user_paragraph_bookmarks').insert({ user_id: userId, paragraph_id: paragraphId })

  if (result.error) throw new Error('Could not save bookmark.')
  revalidatePath(returnPath)
  revalidatePath('/my-learning')
  revalidatePath('/my-notes')
}
