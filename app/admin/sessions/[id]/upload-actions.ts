'use server'

import { randomUUID } from 'node:crypto'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'teaching-materials'

async function requireAdmin() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub as string | undefined
  if (!userId) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return supabase
}

function safeFileName(name: string) {
  const dot = name.lastIndexOf('.')
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file'
  const extension = dot > 0 ? name.slice(dot + 1).replace(/[^A-Za-z0-9]+/g, '').slice(0, 12) : ''
  return extension ? `${stem}.${extension}` : stem
}

export async function createSessionMaterialUploadUrl(sessionId: string, fileName: string) {
  const supabase = await requireAdmin()
  const storagePath = `sessions/${sessionId}/${randomUUID()}-${safeFileName(fileName)}`
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(storagePath)
  if (error || !data?.token) throw new Error(error?.message ?? 'Could not prepare upload.')
  return { storagePath, token: data.token }
}
