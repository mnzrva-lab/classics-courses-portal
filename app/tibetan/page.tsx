import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function matches(term: any, query: string) {
  if (!query) return true
  const values = [
    term.tibetan_script,
    term.transliteration,
    term.english_meaning,
    term.explanation,
    ...(term.aliases ?? []),
  ]
  return values.some((value) => String(value ?? '').toLowerCase().includes(query))
}

export default async function TibetanPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const queryText = (q ?? '').trim()
  const query = queryText.toLowerCase()
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  let isAdmin = false
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
    isAdmin = profile?.role === 'admin'
  }

  const { data: rows } = await supabase
    .from('tibetan_terms')
    .select('id, slug, tibetan_script, transliteration, english_meaning, explanation, aliases, sort_order')
    .eq('status', 'published')
    .order('sort_order')
    .order('transliteration')

  const terms = (rows ?? []).filter((term: any) => matches(term, query))

  return (
    <main className="container page">
      <div className="eyebrow">Tibetan</div>
      <h1>Tibetan glossary</h1>
      <p className="lead">A separate study tool for Tibetan terminology used across the teachings. Search by Tibetan script, transliteration, English meaning, or an alternate form.</p>
      {isAdmin ? (
        <div className="actions">
          <Link className="button sage" href="/admin/tibetan">Manage glossary</Link>
          <Link className="button" href="/admin/tibetan/import">Bulk import</Link>
        </div>
      ) : null}

      <section className="section card sage">
        <div className="eyebrow">Search</div>
        <form className="form-stack" method="get" action="/tibetan">
          <label>Find a term
            <input className="input" type="search" name="q" defaultValue={queryText} placeholder="Tibetan, transliteration, or English meaning…" />
          </label>
          <div className="actions">
            <button className="button red" type="submit">Search glossary</button>
            {queryText ? <Link className="button" href="/tibetan">Clear search</Link> : null}
          </div>
        </form>
      </section>

      <section className="section">
        <div className="eyebrow">Glossary</div>
        <h2>{queryText ? `${terms.length} result${terms.length === 1 ? '' : 's'}` : `${terms.length} published term${terms.length === 1 ? '' : 's'}`}</h2>

        {terms.length ? (
          <div className="grid two">
            {terms.map((term: any) => (
              <Link className="card" key={term.id} href={`/tibetan/${term.slug}`}>
                {term.tibetan_script ? <div style={{ fontSize: 34, lineHeight: 1.3, marginBottom: 8 }}>{term.tibetan_script}</div> : null}
                <div className="eyebrow">{term.transliteration}</div>
                <h2 style={{ fontSize: 28, marginTop: 8 }}>{term.english_meaning}</h2>
                {term.explanation ? <p>{term.explanation.length > 220 ? `${term.explanation.slice(0, 220).trim()}…` : term.explanation}</p> : null}
                {(term.aliases ?? []).length ? <div className="meta">Also: {(term.aliases ?? []).join(', ')}</div> : null}
                <div className="actions"><span className="button">Open term</span></div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card">
            <h2 style={{ fontSize: 30 }}>{queryText ? 'No glossary terms match this search.' : 'The glossary is ready for content.'}</h2>
            <p className="meta">Published terms will appear here as they are added. The portal does not invent or pre-populate Tibetan terminology.</p>
          </div>
        )}
      </section>

      <section className="section"><Link className="button" href="/courses">← Back to Courses</Link></section>
    </main>
  )
}
