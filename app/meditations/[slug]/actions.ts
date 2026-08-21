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

export async function toggleMeditationBookmark(meditationId: string, returnPath: string) {
  const { supabase, userId } = await requireUser()
  const [{ data: settings, error: settingsError }, { data: existing, error: existingError }] = await Promise.all([
    supabase.from('user_settings').select('save_bookmarks').eq('user_id', userId).maybeSingle(),
    supabase
      .from('user_meditation_bookmarks')
      .select('meditation_id')
      .eq('user_id', userId)
      .eq('meditation_id', meditationId)
      .maybeSingle(),
  ])

  if (settingsError || existingError) throw new Error('Could not read bookmark settings.')
  if (!existing && !(settings?.save_bookmarks ?? true)) {
    throw new Error('Bookmark saving is turned off in Privacy & Data.')
  }

  const result = existing
    ? await supabase.from('user_meditation_bookmarks').delete().eq('user_id', userId).eq('meditation_id', meditationId)
    : await supabase.from('user_meditation_bookmarks').insert({ user_id: userId, meditation_id: meditationId })

  if (result.error) throw new Error('Could not save meditation bookmark.')

  revalidatePath(returnPath)
  revalidatePath('/meditations')
  revalidatePath('/my-notes')
  revalidatePath('/my-learning')
}
