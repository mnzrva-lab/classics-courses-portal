import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type GlossaryView = 'all' | 'saved' | 'learning' | 'learned'

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
  searchParams: Promise<{ q?: string; view?: string }>
}) {
  const { q, view } = await searchParams
  const queryText = (q ?? '').trim()
  const query = queryText.toLowerCase()
  const activeView: GlossaryView = view === 'saved' || view === 'learning' || view === 'learned' ? view : 'all'
  const supabase = await createClient()

  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  let isAdmin = false
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
    isAdmin = profile?.role === 'admin'
  }

  const [{ data: rows }, bookmarkResult, progressResult] = await Promise.all([
    supabase
      .from('tibetan_terms')
      .select('id, slug, tibetan_script, transliteration, english_meaning, explanation, aliases, sort_order')
      .eq('status', 'published')
      .order('sort_order')
      .order('transliteration'),
    userId
      ? supabase.from('user_tibetan_bookmarks').select('term_id').eq('user_id', userId)
      : Promise.resolve({ data: [] } as any),
    userId
      ? supabase.from('user_tibetan_flashcard_progress').select('term_id, learning_state, review_count').eq('user_id', userId)
      : Promise.resolve({ data: [] } as any),
  ])

  const bookmarked = new Set<string>((bookmarkResult.data ?? []).map((item: any) => item.term_id))
  const progress = new Map<string, any>((progressResult.data ?? []).map((item: any) => [item.term_id, item] as const))
  const allTerms = rows ?? []
  const learnedCount = allTerms.filter((term: any) => progress.get(term.id)?.learning_state === 'learned').length
  const learningCount = allTerms.filter((term: any) => progress.get(term.id)?.learning_state === 'learning').length
  const newCount = Math.max(0, allTerms.length - learnedCount - learningCount)
  const learnedPercent = allTerms.length ? Math.round((learnedCount / allTerms.length) * 100) : 0

  const terms = allTerms.filter((term: any) => {
    if (!matches(term, query)) return false
    if (!userId || activeView === 'all') return true
    if (activeView === 'saved') return bookmarked.has(term.id)
    return progress.get(term.id)?.learning_state === activeView
  })

  const viewHref = (nextView: GlossaryView) => {
    const params = new URLSearchParams()
    if (queryText) params.set('q', queryText)
    if (nextView !== 'all') params.set('view', nextView)
    const suffix = params.toString()
    return suffix ? `/tibetan?${suffix}` : '/tibetan'
  }

  const viewOptions: Array<[GlossaryView, string]> = [
    ['all', 'All terms'],
    ['saved', `Bookmarked · ${bookmarked.size}`],
    ['learning', `Learning · ${learningCount}`],
    ['learned', `Learned · ${learnedCount}`],
  ]

  return (
    <main className="container page">
      <div className="eyebrow">Tibetan</div>
      <h1>Tibetan glossary</h1>
      <p className="lead">Search Tibetan terminology across the teachings, bookmark terms for later, and study them as flashcards.</p>

      <div className="actions">
        {userId ? <Link className="button red" href="/tibetan/flashcards">Study flashcards</Link> : <Link className="button red" href="/login">Sign in to study</Link>}
        {isAdmin ? <Link className="button sage" href="/admin/tibetan">Manage glossary</Link> : null}
        {isAdmin ? <Link className="button" href="/admin/tibetan/import">Bulk import</Link> : null}
      </div>

      {userId ? (
        <section className="section card">
          <div className="eyebrow">Your glossary progress</div>
          <h2 style={{ fontSize: 30 }}>{learnedCount} of {allTerms.length} terms learned</h2>
          <div style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--cream)', margin: '16px 0 10px' }}>
            <div style={{ width: `${learnedPercent}%`, height: '100%', background: 'var(--sage-dark)' }} />
          </div>
          <div className="meta">{newCount} new · {learningCount} learning · {learnedCount} learned</div>
          <div className="actions" style={{ marginTop: 16 }}>
            {viewOptions.map(([key, label]) => (
              <Link className={`button${activeView === key ? ' sage' : ''}`} key={key} href={viewHref(key)}>{label}</Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="section card sage">
        <div className="eyebrow">Search</div>
        <form className="form-stack" method="get" action="/tibetan">
          <label>Find a term
            <input className="input" type="search" name="q" defaultValue={queryText} placeholder="Tibetan, transliteration, or English meaning…" />
          </label>
          {activeView !== 'all' ? <input type="hidden" name="view" value={activeView} /> : null}
          <div className="actions">
            <button className="button red" type="submit">Search glossary</button>
            {queryText ? <Link className="button" href={viewHref(activeView)}>Clear search</Link> : null}
          </div>
        </form>
      </section>

      <section className="section">
        <div className="eyebrow">Glossary</div>
        <h2>{queryText ? `${terms.length} result${terms.length === 1 ? '' : 's'}` : `${terms.length} term${terms.length === 1 ? '' : 's'}`}</h2>

        {terms.length ? (
          <div className="grid two">
            {terms.map((term: any) => {
              const termProgress = progress.get(term.id)
              const state = termProgress?.learning_state === 'learned' ? 'Learned' : termProgress?.learning_state === 'learning' ? 'Learning' : 'New'
              return (
                <Link className="card" key={term.id} href={`/tibetan/${term.slug}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      {term.tibetan_script ? <div style={{ fontSize: 34, lineHeight: 1.3, marginBottom: 8 }}>{term.tibetan_script}</div> : null}
                      <div className="eyebrow">{term.transliteration}</div>
                    </div>
                    {userId ? <span className="pill">{bookmarked.has(term.id) ? '★ ' : ''}{state}</span> : null}
                  </div>
                  <h2 style={{ fontSize: 28, marginTop: 8 }}>{term.english_meaning}</h2>
                  {term.explanation ? <p>{term.explanation.length > 220 ? `${term.explanation.slice(0, 220).trim()}…` : term.explanation}</p> : null}
                  {(term.aliases ?? []).length ? <div className="meta">Also: {(term.aliases ?? []).join(', ')}</div> : null}
                  <div className="actions"><span className="button">Open term</span></div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="card">
            <h2 style={{ fontSize: 30 }}>{queryText ? 'No glossary terms match this search.' : 'No terms in this view yet.'}</h2>
            <p className="meta">Try another filter or return to all glossary terms.</p>
          </div>
        )}
      </section>

      <section className="section"><Link className="button" href="/courses">← Back to Courses</Link></section>
    </main>
  )
}
