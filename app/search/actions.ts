'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function submitTeachingSearch(formData: FormData) {
  const query = String(formData.get('q') ?? '').trim()
  if (!query) redirect('/search')

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub as string | undefined

  if (userId) {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('save_search_history')
      .eq('user_id', userId)
      .maybeSingle()

    if (settings?.save_search_history) {
      const { data: latest } = await supabase
        .from('user_search_history')
        .select('query')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latest?.query !== query) {
        await supabase.from('user_search_history').insert({ user_id: userId, query })
      }
    }
  }

  redirect(`/search?q=${encodeURIComponent(query)}`)
}
