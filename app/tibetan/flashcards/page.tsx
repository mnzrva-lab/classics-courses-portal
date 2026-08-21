import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { recordTibetanFlashcard, toggleTibetanBookmark } from '../actions'

export const dynamic = 'force-dynamic'

export default async function TibetanFlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string; scope?: string }>
}) {
  const { term: termSlug, scope } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const [{ data: terms }, { data: progressRows }, { data: bookmarks }, { data: settings }] = await Promise.all([
    supabase
      .from('tibetan_terms')
      .select('id, slug, tibetan_script, transliteration, english_meaning, explanation, aliases, sort_order')
      .eq('status', 'published')
      .order('sort_order')
      .order('transliteration'),
    supabase
      .from('user_tibetan_flashcard_progress')
      .select('term_id, learning_state, review_count, correct_count, last_result, last_reviewed_at')
      .eq('user_id', userId),
    supabase
      .from('user_tibetan_bookmarks')
      .select('term_id')
      .eq('user_id', userId),
    supabase
      .from('user_settings')
      .select('save_bookmarks, save_progress')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  const progress = new Map((progressRows ?? []).map((item: any) => [item.term_id, item]))
  const bookmarked = new Set((bookmarks ?? []).map((item: any) => item.term_id))
  const allTerms = terms ?? []
  const scopedTerms = scope === 'saved' ? allTerms.filter((item: any) => bookmarked.has(item.id)) : allTerms
  const ordered = [...scopedTerms].sort((a: any, b: any) => {
    const stateRank = (item: any) => {
      const state = progress.get(item.id)?.learning_state
      if (state === 'learning') return 0
      if (state === 'learned') return 2
      return 1
    }
    return stateRank(a) - stateRank(b) || a.sort_order - b.sort_order || a.transliteration.localeCompare(b.transliteration)
  })

  if (!ordered.length) {
    return (
      <main className="container page">
        <div className="actions"><Link className="button" href="/tibetan">← Tibetan glossary</Link></div>
        <div className="eyebrow">Tibetan</div>
        <h1>Flashcards</h1>
        <section className="section card">
          <h2>{scope === 'saved' ? 'No bookmarked terms yet.' : 'No published terms yet.'}</h2>
          <p className="meta">{scope === 'saved' ? 'Bookmark terms in the glossary, then study only those cards here.' : 'Flashcards appear automatically when glossary terms are published.'}</p>
          <div className="actions"><Link className="button red" href="/tibetan">Open glossary</Link></div>
        </section>
      </main>
    )
  }

  let index = ordered.findIndex((item: any) => item.slug === termSlug)
  if (index < 0) index = 0
  const current: any = ordered[index]
  const currentProgress: any = progress.get(current.id)
  const currentState = currentProgress?.learning_state === 'learned' ? 'Learned' : currentProgress?.learning_state === 'learning' ? 'Learning' : 'New'
  const learnedCount = allTerms.filter((item: any) => progress.get(item.id)?.learning_state === 'learned').length
  const learningCount = allTerms.filter((item: any) => progress.get(item.id)?.learning_state === 'learning').length
  const newCount = Math.max(0, allTerms.length - learnedCount - learningCount)
  const learnedPercent = allTerms.length ? Math.round((learnedCount / allTerms.length) * 100) : 0
  const canSaveProgress = settings?.save_progress ?? true
  const canSaveBookmarks = settings?.save_bookmarks ?? true
  const isBookmarked = bookmarked.has(current.id)
  const queryFor = (slug: string) => `/tibetan/flashcards?term=${encodeURIComponent(slug)}${scope === 'saved' ? '&scope=saved' : ''}`
  const returnPath = queryFor(current.slug)
  const previous = ordered[(index - 1 + ordered.length) % ordered.length]
  const next = ordered[(index + 1) % ordered.length]

  return (
    <main className="container page">
      <div className="actions" style={{ marginTop: 0, marginBottom: 18 }}>
        <Link className="button" href="/tibetan">← Tibetan glossary</Link>
        <Link className={`button${scope !== 'saved' ? ' sage' : ''}`} href="/tibetan/flashcards">All terms</Link>
        <Link className={`button${scope === 'saved' ? ' sage' : ''}`} href="/tibetan/flashcards?scope=saved">Bookmarked</Link>
      </div>

      <div className="eyebrow">Tibetan study</div>
      <h1>Flashcards</h1>
      <p className="lead">Review one term at a time. Learning terms come first, then new terms, then terms already learned.</p>

      <section className="section card">
        <div className="eyebrow">Your progress</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 30, marginBottom: 0 }}>{learnedCount} of {allTerms.length} learned</h2>
          <div className="meta">{newCount} new · {learningCount} learning · {learnedCount} learned</div>
        </div>
        <div style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--cream)', marginTop: 16 }}>
          <div style={{ width: `${learnedPercent}%`, height: '100%', background: 'var(--sage-dark)' }} />
        </div>
      </section>

      <section className="section card sage" style={{ textAlign: 'center', padding: 'clamp(26px, 5vw, 54px)' }}>
        <div className="meta">Card {index + 1} of {ordered.length} · {currentState}</div>
        {current.tibetan_script ? <div style={{ fontSize: 'clamp(52px, 10vw, 96px)', lineHeight: 1.2, margin: '28px 0 12px' }}>{current.tibetan_script}</div> : null}
        <h2 style={{ fontSize: 'clamp(32px, 6vw, 52px)', margin: '10px 0' }}>{current.transliteration}</h2>

        <details style={{ margin: '28px auto 0', maxWidth: 720, textAlign: 'left' }}>
          <summary className="button red" style={{ display: 'inline-flex', cursor: 'pointer' }}>Reveal answer</summary>
          <div className="card" style={{ marginTop: 18 }}>
            <div className="eyebrow">English meaning</div>
            <h2 style={{ fontSize: 34 }}>{current.english_meaning}</h2>
            {current.explanation ? <p style={{ lineHeight: 1.75 }}>{current.explanation}</p> : null}
            {(current.aliases ?? []).length ? <div className="meta">Also: {(current.aliases ?? []).join(', ')}</div> : null}

            {canSaveProgress ? (
              <div className="actions" style={{ marginTop: 22 }}>
                <form action={recordTibetanFlashcard.bind(null, current.id, 'again', returnPath)}>
                  <button className="button" type="submit">Again</button>
                </form>
                <form action={recordTibetanFlashcard.bind(null, current.id, 'learning', returnPath)}>
                  <button className="button" type="submit">Still learning</button>
                </form>
                <form action={recordTibetanFlashcard.bind(null, current.id, 'learned', returnPath)}>
                  <button className="button sage" type="submit">Learned</button>
                </form>
              </div>
            ) : <div className="actions"><Link className="button" href="/account">Progress tracking is off</Link></div>}
          </div>
        </details>

        <div className="actions" style={{ justifyContent: 'center', marginTop: 28 }}>
          <Link className="button" href={queryFor(previous.slug)}>← Previous</Link>
          {canSaveBookmarks || isBookmarked ? (
            <form action={toggleTibetanBookmark.bind(null, current.id, returnPath)}>
              <button className="button" type="submit">{isBookmarked ? '★ Bookmarked' : '☆ Bookmark'}</button>
            </form>
          ) : null}
          <Link className="button" href={`/tibetan/${current.slug}`}>Open term</Link>
          <Link className="button" href={queryFor(next.slug)}>Next →</Link>
        </div>
      </section>
    </main>
  )
}
