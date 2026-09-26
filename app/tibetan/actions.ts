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

export async function toggleTibetanBookmark(termId: string, returnPath: string) {
  const { supabase, userId } = await requireUser()
  const [{ data: settings, error: settingsError }, { data: existing, error: existingError }] = await Promise.all([
    supabase.from('user_settings').select('save_bookmarks').eq('user_id', userId).maybeSingle(),
    supabase.from('user_tibetan_bookmarks').select('term_id').eq('user_id', userId).eq('term_id', termId).maybeSingle(),
  ])

  if (settingsError || existingError) throw new Error('Could not read bookmark settings.')
  if (!existing && !(settings?.save_bookmarks ?? true)) {
    throw new Error('Bookmark saving is turned off in Privacy & Data.')
  }

  const result = existing
    ? await supabase.from('user_tibetan_bookmarks').delete().eq('user_id', userId).eq('term_id', termId)
    : await supabase.from('user_tibetan_bookmarks').insert({ user_id: userId, term_id: termId })

  if (result.error) throw new Error('Could not save Tibetan bookmark.')

  revalidatePath(returnPath)
  revalidatePath('/tibetan')
  revalidatePath('/tibetan/flashcards')
  revalidatePath('/my-learning')
}

export async function recordTibetanFlashcard(termId: string, result: 'again' | 'learning' | 'learned', returnPath: string) {
  const { supabase, userId } = await requireUser()
  const { data: settings, error: settingsError } = await supabase
    .from('user_settings')
    .select('save_progress')
    .eq('user_id', userId)
    .maybeSingle()

  if (settingsError) throw new Error('Could not read progress settings.')
  if (!(settings?.save_progress ?? true)) {
    throw new Error('Progress tracking is turned off in Privacy & Data.')
  }

  const { data: existing, error: existingError } = await supabase
    .from('user_tibetan_flashcard_progress')
    .select('review_count, correct_count')
    .eq('user_id', userId)
    .eq('term_id', termId)
    .maybeSingle()

  if (existingError) throw new Error('Could not read flashcard progress.')

  const reviewCount = (existing?.review_count ?? 0) + 1
  const correctCount = (existing?.correct_count ?? 0) + (result === 'learned' ? 1 : 0)
  const learningState = result === 'learned' ? 'learned' : 'learning'

  const { error } = await supabase.from('user_tibetan_flashcard_progress').upsert({
    user_id: userId,
    term_id: termId,
    learning_state: learningState,
    review_count: reviewCount,
    correct_count: correctCount,
    last_result: result,
    last_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,term_id' })

  if (error) throw new Error('Could not save flashcard progress.')

  revalidatePath(returnPath)
  revalidatePath('/tibetan')
  revalidatePath('/tibetan/flashcards')
  revalidatePath('/my-learning')
}
