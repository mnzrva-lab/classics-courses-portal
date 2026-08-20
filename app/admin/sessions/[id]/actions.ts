'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') throw new Error('Admin access required')

  return supabase
}

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

export async function updateSession(sessionId: string, formData: FormData) {
  const supabase = await requireAdmin()
  const status = String(formData.get('status') ?? 'draft')
  if (!['draft', 'published', 'archived'].includes(status)) throw new Error('Invalid status')

  const { error } = await supabase
    .from('sessions')
    .update({
      code: optionalText(formData.get('code')),
      title: String(formData.get('title') ?? '').trim(),
      session_date: optionalText(formData.get('session_date')),
      starts_at: optionalText(formData.get('starts_at')),
      ends_at: optionalText(formData.get('ends_at')),
      source_timezone: optionalText(formData.get('source_timezone')),
      recording_url: optionalText(formData.get('recording_url')),
      audio_url: optionalText(formData.get('audio_url')),
      zoom_url: optionalText(formData.get('zoom_url')),
      required_for_completion: formData.get('required_for_completion') === 'on',
      status,
    })
    .eq('id', sessionId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin')
  revalidatePath('/', 'layout')
  redirect(`/admin/sessions/${sessionId}?saved=1`)
}
