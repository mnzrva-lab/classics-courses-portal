import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TibetanManagerClient from './tibetan-manager-client'

export const dynamic = 'force-dynamic'

export default async function AdminTibetanPage({ searchParams }: { searchParams: Promise<{ created?: string; saved?: string }> }) {
  const { created, saved } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') redirect('/my-learning')

  const { data: terms } = await supabase
    .from('tibetan_terms')
    .select('id, slug, tibetan_script, transliteration, english_meaning, explanation, aliases, status, sort_order')
    .order('sort_order')
    .order('transliteration')

  const message = created === 'term' ? 'Tibetan term created.' : saved === 'term' ? 'Tibetan term updated.' : null

  return (
    <main className="container page">
      <div className="actions" style={{ marginTop: 0, marginBottom: 18 }}>
        <Link className="button" href="/admin">← Admin</Link>
        <Link className="button" href="/tibetan">Open student glossary</Link>
        <Link className="button sage" href="/admin/tibetan/import">Bulk import</Link>
      </div>
      <div className="eyebrow">Admin · Tibetan</div>
      <h1>Tibetan glossary</h1>
      <p className="lead">Keep the glossary compact. Open a term only when you need to edit it or manage its teaching sources.</p>
      {message ? <div className="card completed admin-course-notice">{message}</div> : null}
      <TibetanManagerClient terms={(terms ?? []) as any} />
    </main>
  )
}
