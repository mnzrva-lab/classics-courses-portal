import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createTibetanTerm, updateTibetanTerm } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminTibetanPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; saved?: string }>
}) {
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

  const message = created === 'term'
    ? 'Tibetan term created.'
    : saved === 'term'
      ? 'Tibetan term updated.'
      : null

  return (
    <main className="container page">
      <div className="actions" style={{ marginTop: 0, marginBottom: 18 }}>
        <Link className="button" href="/admin">← Admin</Link>
        <Link className="button" href="/tibetan">Open student glossary</Link>
        <Link className="button sage" href="/admin/tibetan/import">Bulk import</Link>
      </div>
      <div className="eyebrow">Admin · Tibetan</div>
      <h1>Tibetan glossary</h1>
      <p className="lead">Maintain Tibetan terms as a separate study tool. New entries can remain Draft until they are reviewed.</p>

      {message ? <div className="card completed section">{message}</div> : null}

      <section className="section card sage">
        <div className="eyebrow">New term</div>
        <h2 style={{ fontSize: 32 }}>Add a Tibetan term</h2>
        <form className="form-stack" action={createTibetanTerm}>
          <div className="grid two">
            <label>Tibetan script<input className="input" name="tibetan_script" placeholder="Optional" /></label>
            <label>Transliteration<input className="input" name="transliteration" required /></label>
            <label>English meaning<input className="input" name="english_meaning" required /></label>
            <label>Aliases<input className="input" name="aliases" placeholder="Comma-separated alternate forms" /></label>
            <label>Status
              <select className="input" name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>Sort order<input className="input" name="sort_order" type="number" defaultValue="0" /></label>
          </div>
          <label>Explanation<textarea className="input" name="explanation" rows={5} /></label>
          <div className="actions"><button className="button red" type="submit">Create term</button></div>
        </form>
      </section>

      <section className="section">
        <div className="eyebrow">Glossary entries</div>
        <h2>{terms?.length ?? 0} term{terms?.length === 1 ? '' : 's'}</h2>

        {(terms ?? []).length ? (terms ?? []).map((term: any) => (
          <div className="card" key={term.id} style={{ marginBottom: 22 }}>
            <div className="eyebrow">{term.status} · /tibetan/{term.slug}</div>
            {term.tibetan_script ? <div style={{ fontSize: 34, marginTop: 8 }}>{term.tibetan_script}</div> : null}
            <h2 style={{ fontSize: 30 }}>{term.transliteration}</h2>
            <p>{term.english_meaning}</p>

            <form className="form-stack" action={updateTibetanTerm.bind(null, term.id, term.slug)}>
              <div className="grid two">
                <label>Tibetan script<input className="input" name="tibetan_script" defaultValue={term.tibetan_script ?? ''} /></label>
                <label>Transliteration<input className="input" name="transliteration" required defaultValue={term.transliteration} /></label>
                <label>English meaning<input className="input" name="english_meaning" required defaultValue={term.english_meaning} /></label>
                <label>Aliases<input className="input" name="aliases" defaultValue={(term.aliases ?? []).join(', ')} /></label>
                <label>Status
                  <select className="input" name="status" defaultValue={term.status}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label>Sort order<input className="input" name="sort_order" type="number" defaultValue={term.sort_order ?? 0} /></label>
              </div>
              <label>Explanation<textarea className="input" name="explanation" rows={5} defaultValue={term.explanation ?? ''} /></label>
              <div className="actions">
                <button className="button" type="submit">Save term</button>
                {term.status === 'published' ? <Link className="button" href={`/tibetan/${term.slug}`}>Open term</Link> : null}
              </div>
            </form>
          </div>
        )) : <div className="card"><p className="meta">No glossary terms yet. Nothing has been pre-populated.</p></div>}
      </section>
    </main>
  )
}
