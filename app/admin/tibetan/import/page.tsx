import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { bulkImportTibetanTerms } from './actions'

export const dynamic = 'force-dynamic'

export default async function TibetanImportPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; skipped?: string; invalid?: string; sources?: string }>
}) {
  const stats = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') redirect('/my-learning')

  const hasResult = stats.created != null || stats.skipped != null || stats.invalid != null

  return (
    <main className="container page">
      <div className="actions" style={{ marginTop: 0, marginBottom: 18 }}>
        <Link className="button" href="/admin/tibetan">← Manage Tibetan glossary</Link>
        <Link className="button" href="/tibetan">Open student glossary</Link>
      </div>
      <div className="eyebrow">Admin · Tibetan</div>
      <h1>Bulk import glossary terms</h1>
      <p className="lead">Paste rows from Google Sheets or Excel, or paste CSV. Every imported term is created as Draft so nothing becomes public before review.</p>

      {hasResult ? (
        <section className="section card completed">
          <strong>Import finished</strong>
          <div className="meta" style={{ marginTop: 6 }}>
            {stats.created ?? '0'} created · {stats.skipped ?? '0'} existing terms skipped · {stats.invalid ?? '0'} invalid rows · {stats.sources ?? '0'} source references added
          </div>
        </section>
      ) : null}

      <section className="section card sage">
        <div className="eyebrow">Columns</div>
        <h2 style={{ fontSize: 32 }}>Required and optional fields</h2>
        <p><strong>Required:</strong> <code>transliteration</code>, <code>english_meaning</code></p>
        <p><strong>Optional:</strong> <code>tibetan_script</code>, <code>aliases</code>, <code>explanation</code>, <code>sort_order</code>, <code>source_label</code>, <code>source_url</code>, <code>source_note</code></p>
        <p className="meta">For aliases, separate alternate forms with <strong>|</strong> or <strong>;</strong>. Existing slugs are skipped rather than overwritten.</p>
      </section>

      <section className="section card">
        <form className="form-stack" action={bulkImportTibetanTerms}>
          <label>Paste spreadsheet rows or CSV
            <textarea
              className="input"
              name="rows"
              rows={18}
              required
              spellCheck={false}
              placeholder={'transliteration\tenglish_meaning\ttibetan_script\taliases\texplanation\n...'}
            />
          </label>
          <div className="actions"><button className="button red" type="submit">Import as Draft</button></div>
        </form>
      </section>

      <section className="section card">
        <div className="eyebrow">Safe import behavior</div>
        <h2 style={{ fontSize: 30 }}>What this importer will not do</h2>
        <p className="meta">It does not publish imported terms, overwrite an existing term with the same generated slug, or invent missing Tibetan content. Invalid rows are skipped and reported in the summary.</p>
      </section>
    </main>
  )
}
