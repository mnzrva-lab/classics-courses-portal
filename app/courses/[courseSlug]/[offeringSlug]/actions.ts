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

export async function toggleCourseBookmark(courseId: string, returnPath: string) {
  const { supabase, userId } = await requireUser()

  const [{ data: existing, error: existingError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase
      .from('user_course_bookmarks')
      .select('course_id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle(),
    supabase
      .from('user_settings')
      .select('save_bookmarks')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (existingError || settingsError) throw new Error('Could not read bookmark state.')
  if (!existing && !(settings?.save_bookmarks ?? true)) throw new Error('Bookmark saving is turned off in Privacy & Data.')

  if (existing) {
    const { error } = await supabase
      .from('user_course_bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('course_id', courseId)
    if (error) throw new Error('Could not remove bookmark.')
  } else {
    const { error } = await supabase.from('user_course_bookmarks').insert({ user_id: userId, course_id: courseId })
    if (error) throw new Error('Could not save bookmark.')
  }

  revalidatePath(returnPath)
  revalidatePath('/my-learning')
  revalidatePath('/my-notes')
}
