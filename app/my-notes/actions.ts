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

export async function updateNote(noteId: string, formData: FormData) {
  const note = String(formData.get('note') ?? '').trim()
  if (!note) throw new Error('Note cannot be empty.')

  const { supabase, userId } = await requireUser()
  const { error } = await supabase
    .from('student_notes')
    .update({ note, updated_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('user_id', userId)

  if (error) throw new Error('Could not update note.')
  revalidatePath('/my-notes')
  revalidatePath('/my-learning')
  redirect('/my-notes?saved=note')
}

export async function deleteNote(noteId: string) {
  const { supabase, userId } = await requireUser()
  const { error } = await supabase
    .from('student_notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', userId)

  if (error) throw new Error('Could not delete note.')
  revalidatePath('/my-notes')
  revalidatePath('/my-learning')
  redirect('/my-notes?saved=deleted')
}
