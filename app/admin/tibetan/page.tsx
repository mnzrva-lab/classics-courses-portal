import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TibetanManagerClient from './tibetan-manager-client'

export const dynamic = 'force-dynamic'

export default async function AdminTibetanPage({ searchParams }: { searchParams: Promise<{ created?: string; saved?: string; bulk?: string; count?: string; detected?: string; linked?: string }> }) {
  const { created, saved, bulk, count, detected, linked } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') redirect('/my-learning')

  const [{ data: terms }, { data: sessions }] = await Promise.all([
    supabase
      .from('tibetan_terms')
      .select('id, slug, transliteration, english_meaning, explanation, aliases, status, sort_order')
      .order('sort_order')
      .order('transliteration'),
    supabase
      .from('sessions')
      .select('id, code, title, starts_at')
      .order('starts_at', { ascending: false, nullsFirst: false })
      .limit(250),
  ])

  let message: string | null = null
  if (created === 'term') message = 'Tibetan term created as a Draft.'
  else if (saved === 'term') message = 'Tibetan term updated.'
  else if (bulk && count) message = `${count} term${count === '1' ? '' : 's'} moved to ${bulk}.`
  else if (detected != null || linked != null) message = `Transcript scan finished: ${detected ?? '0'} new Draft term${detected === '1' ? '' : 's'}, ${linked ?? '0'} source link${linked === '1' ? '' : 's'} added.`

  return (
    <main className="container page">
      <div className="actions" style={{ marginTop: 0, marginBottom: 18 }}>
        <Link className="button" href="/admin">← Admin</Link>
        <Link className="button" href="/tibetan">Open student glossary</Link>
        <Link className="button sage" href="/admin/tibetan/import">Bulk import</Link>
      </div>
      <div className="eyebrow">Admin · Tibetan</div>
      <h1>Tibetan glossary</h1>
      <p className="lead">Review terms quickly, publish in batches, and connect each term to the exact teaching passages where it appears.</p>
      {message ? <div className="card completed admin-course-notice">{message}</div> : null}
      <TibetanManagerClient terms={(terms ?? []) as any} sessions={(sessions ?? []).map((session: any) => ({ id: session.id, code: session.code, title: session.title }))} />
    </main>
  )
}
