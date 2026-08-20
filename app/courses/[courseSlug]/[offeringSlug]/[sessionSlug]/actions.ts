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

async function touchProgress(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, sessionId: string) {
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
  await touchProgress(supabase, userId, sessionId)
  revalidatePath(returnPath)
  revalidatePath('/my-learning')
}

export async function markSessionComplete(sessionId: string, returnPath: string) {
  const { supabase, userId } = await requireUser()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('user_session_progress')
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        last_opened_at: now,
        completed_at: now,
      },
      { onConflict: 'user_id,session_id' }
    )

  if (error) throw new Error('Could not save completion.')
  revalidatePath(returnPath)
  revalidatePath('/my-learning')
}

export async function saveSessionNote(sessionId: string, returnPath: string, formData: FormData) {
  const note = String(formData.get('note') || '').trim()
  if (!note) return

  const { supabase, userId } = await requireUser()
  const { error } = await supabase.from('student_notes').insert({
    user_id: userId,
    session_id: sessionId,
    note,
  })

  if (error) throw new Error('Could not save note.')
  await touchProgress(supabase, userId, sessionId)
  revalidatePath(returnPath)
  revalidatePath('/my-learning')
  revalidatePath('/my-notes')
}

export async function toggleSessionBookmark(sessionId: string, returnPath: string) {
  const { supabase, userId } = await requireUser()
  const { data: existing, error: readError } = await supabase
    .from('user_session_bookmarks')
    .select('session_id')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (readError) throw new Error('Could not read bookmark.')

  const result = existing
    ? await supabase.from('user_session_bookmarks').delete().eq('user_id', userId).eq('session_id', sessionId)
    : await supabase.from('user_session_bookmarks').insert({ user_id: userId, session_id: sessionId })

  if (result.error) throw new Error('Could not save bookmark.')
  await touchProgress(supabase, userId, sessionId)
  revalidatePath(returnPath)
  revalidatePath('/my-learning')
  revalidatePath('/my-notes')
}

export async function toggleParagraphBookmark(paragraphId: string, returnPath: string) {
  const { supabase, userId } = await requireUser()
  const { data: existing, error: readError } = await supabase
    .from('user_paragraph_bookmarks')
    .select('paragraph_id, transcript_paragraphs(transcripts(session_id))')
    .eq('user_id', userId)
    .eq('paragraph_id', paragraphId)
    .maybeSingle()

  if (readError) throw new Error('Could not read bookmark.')

  const result = existing
    ? await supabase.from('user_paragraph_bookmarks').delete().eq('user_id', userId).eq('paragraph_id', paragraphId)
    : await supabase.from('user_paragraph_bookmarks').insert({ user_id: userId, paragraph_id: paragraphId })

  if (result.error) throw new Error('Could not save bookmark.')
  revalidatePath(returnPath)
  revalidatePath('/my-learning')
  revalidatePath('/my-notes')
}
