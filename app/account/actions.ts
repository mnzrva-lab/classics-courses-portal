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

function checked(formData: FormData, name: string) {
  return formData.get(name) === 'on'
}

function confirmation(formData: FormData, phrase: string) {
  return String(formData.get('confirmation') ?? '').trim() === phrase
}

export async function updatePrivacySettings(formData: FormData) {
  const { supabase, userId } = await requireUser()
  const timezone = String(formData.get('timezone') ?? '').trim() || null

  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    save_notes: checked(formData, 'save_notes'),
    save_bookmarks: checked(formData, 'save_bookmarks'),
    save_progress: checked(formData, 'save_progress'),
    save_search_history: checked(formData, 'save_search_history'),
    track_classics_master: checked(formData, 'track_classics_master'),
    timezone,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (error) throw new Error('Could not save privacy settings.')

  revalidatePath('/account')
  revalidatePath('/my-learning')
  redirect('/account?saved=settings')
}

export async function clearSearchHistory() {
  const { supabase, userId } = await requireUser()
  const { error } = await supabase.from('user_search_history').delete().eq('user_id', userId)
  if (error) throw new Error('Could not clear search history.')

  revalidatePath('/account')
  redirect('/account?saved=search-history')
}

export async function deleteAllNotes(formData: FormData) {
  if (!confirmation(formData, 'DELETE NOTES')) throw new Error('Type DELETE NOTES exactly to continue.')
  const { supabase, userId } = await requireUser()
  const { error } = await supabase.from('student_notes').delete().eq('user_id', userId)
  if (error) throw new Error('Could not delete notes.')

  revalidatePath('/account')
  revalidatePath('/my-learning')
  revalidatePath('/my-notes')
  redirect('/account?saved=notes-deleted')
}

export async function clearAllBookmarks(formData: FormData) {
  if (!confirmation(formData, 'CLEAR BOOKMARKS')) throw new Error('Type CLEAR BOOKMARKS exactly to continue.')
  const { supabase, userId } = await requireUser()

  const results = await Promise.all([
    supabase.from('user_course_bookmarks').delete().eq('user_id', userId),
    supabase.from('user_session_bookmarks').delete().eq('user_id', userId),
    supabase.from('user_paragraph_bookmarks').delete().eq('user_id', userId),
    supabase.from('user_meditation_bookmarks').delete().eq('user_id', userId),
  ])

  if (results.some((result) => result.error)) throw new Error('Could not clear all bookmarks.')

  revalidatePath('/account')
  revalidatePath('/my-learning')
  revalidatePath('/my-notes')
  revalidatePath('/meditations')
  redirect('/account?saved=bookmarks-cleared')
}

export async function resetCourseProgress(courseId: string, formData: FormData) {
  if (!confirmation(formData, 'RESET COURSE')) throw new Error('Type RESET COURSE exactly to continue.')
  const { supabase, userId } = await requireUser()

  const { data: sessions, error: sessionError } = await supabase
    .from('sessions')
    .select('id')
    .eq('course_id', courseId)

  if (sessionError) throw new Error('Could not read course sessions.')
  const sessionIds = (sessions ?? []).map((item) => item.id)

  if (sessionIds.length > 0) {
    const { error } = await supabase
      .from('user_session_progress')
      .delete()
      .eq('user_id', userId)
      .in('session_id', sessionIds)

    if (error) throw new Error('Could not reset this course.')
  }

  revalidatePath('/account')
  revalidatePath('/my-learning')
  redirect(`/account?saved=course-reset&course=${encodeURIComponent(courseId)}`)
}

export async function resetAllProgress(formData: FormData) {
  if (!confirmation(formData, 'RESET PROGRESS')) throw new Error('Type RESET PROGRESS exactly to continue.')
  const { supabase, userId } = await requireUser()
  const { error } = await supabase.from('user_session_progress').delete().eq('user_id', userId)
  if (error) throw new Error('Could not reset progress.')

  revalidatePath('/account')
  revalidatePath('/my-learning')
  redirect('/account?saved=progress-reset')
}

export async function deleteAccount(formData: FormData) {
  if (!confirmation(formData, 'DELETE ACCOUNT')) throw new Error('Type DELETE ACCOUNT exactly to continue.')
  const { supabase } = await requireUser()

  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw new Error('Could not delete your account. Please try again.')

  await supabase.auth.signOut()
  redirect('/')
}
