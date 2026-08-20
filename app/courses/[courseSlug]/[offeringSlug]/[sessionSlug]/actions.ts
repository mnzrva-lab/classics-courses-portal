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
  revalidatePath(returnPath)
  revalidatePath('/my-learning')
}
