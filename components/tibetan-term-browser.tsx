'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import TibetanStarButton from '@/components/tibetan-star-button'
import { useTibetanStars } from '@/components/use-tibetan-stars'
import { matchesTibetanTermName } from '@/lib/tibetan-term-search'

export type TibetanTermSummary = {
  term: string
  slug: string
  context: string
  source: string
  occurrenceCount: number
}

type Props = { terms: TibetanTermSummary[]; savedOnly?: boolean }
type Layout = 'cards' | 'list'
const PAGE_SIZE = 24
const VIEW_KEY = 'classics-library:tibetan-view:v1'

export default function TibetanTermBrowser({ terms, savedOnly = false }: Props) {
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useState<Layout>('cards')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { idSet, ready, toggle } = useTibetanStars()
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === 'list') setLayout('list')
    } catch {
      // Keep the default layout when storage is unavailable.
    }
  }, [])

  function chooseLayout(next: Layout) {
    setLayout(next)
    try { window.localStorage.setItem(VIEW_KEY, next) } catch { /* Nonessential preference. */ }
  }

  const results = useMemo(() => terms.filter((item) => (
    (!savedOnly || idSet.has(item.slug)) &&
    matchesTibetanTermName(item.term, query)
  )), [terms, savedOnly, idSet, query])

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [query, savedOnly])

  useEffect(() => {
    if (visibleCount >= results.length) return
    const node = sentinel.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((current) => Math.min(current + PAGE_SIZE, results.length))
      }
    }, { rootMargin: '320px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [visibleCount, results.length])

  const visible = results.slice(0, visibleCount)
  const hasMore = visibleCount < results.length
  const empty = ready && results.length === 0

  return (
    <section className="section tibetan-browser" aria-label={savedOnly ? 'My saved Tibetan terms' : 'Tibetan glossary browser'}>
      <div className="tibetan-browser-toolbar">
        <label className="tibetan-browser-search">
          <span className="sr-only">Search Tibetan term names</span>
          <span aria-hidden="true" className="tibetan-browser-search-symbol">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Tibetan terms"
            aria-label="Search Tibetan term names only"
          />
          {query ? <button type="button" className="tibetan-browser-clear" onClick={() => setQuery('')} aria-label="Clear Tibetan search">Clear</button> : null}
        </label>
        <div className="tibetan-browser-toolbar-actions">
          <div role="group" aria-label="Term display layout" className="tibetan-browser-view-switch">
            <button type="button" className={layout === 'cards' ? 'is-active' : ''} onClick={() => chooseLayout('cards')} aria-pressed={layout === 'cards'}>Cards</button>
            <button type="button" className={layout === 'list' ? 'is-active' : ''} onClick={() => chooseLayout('list')} aria-pressed={layout === 'list'}>List</button>
          </div>
          <Link className="tibetan-browser-saved-link" href={savedOnly ? '/tibetan' : '/tibetan/saved'}>
            {savedOnly ? 'All terms' : '★ Saved terms' + (ready ? ' (' + idSet.size + ')' : '')}
          </Link>
        </div>
      </div>
      <div className="tibetan-browser-info" aria-live="polite">
        <span>{!ready && savedOnly ? 'Loading saved terms…' : results.length + ' ' + (savedOnly ? 'saved ' : '') + (results.length === 1 ? 'term' : 'terms') + (query ? ' found' : '')}</span>
        <span>Search checks term names only.</span>
      </div>
      {empty ? (
        <div className="tibetan-browser-empty">
          {savedOnly && !query ? (
            <>
              <h2>No saved terms yet</h2>
              <p>Star a Tibetan term from the glossary or from its term page to keep it here.</p>
              <Link className="button sage" href="/tibetan">Browse Tibetan terms</Link>
            </>
          ) : (
            <>
              <h2>No matching terms</h2>
              <p>Try a shorter spelling, or clear the search to browse all {savedOnly ? 'saved' : 'available'} terms.</p>
              <button type="button" className="button" onClick={() => setQuery('')}>Clear search</button>
            </>
          )}
        </div>
      ) : (
        <div className={'tibetan-term-browser-grid tibetan-term-grid ' + (layout === 'list' ? 'is-list' : 'is-cards')}>
          {visible.map((item) => (
            <article className="tibetan-term-card tibetan-term-browser-item" key={item.slug}>
              <div className="tibetan-term-browser-heading">
                <h2>{item.term}</h2>
                <TibetanStarButton
                  term={item.term}
                  starred={idSet.has(item.slug)}
                  disabled={!ready}
                  toggle={() => toggle(item.slug)}
                />
              </div>
              <p className="tibetan-term-context">{item.context}</p>
              <div className="tibetan-term-source">{item.source}</div>
              <div className="tibetan-term-browser-foot">
                <span className="tibetan-term-count">{item.occurrenceCount} source {item.occurrenceCount === 1 ? 'passage' : 'passages'}</span>
                <Link className="tibetan-term-hub-link" href={'/tibetan/source/' + item.slug}>View term hub →</Link>
              </div>
            </article>
          ))}
        </div>
      )}
      {hasMore ? (
        <div ref={sentinel} className="tibetan-browser-more" aria-live="polite">
          <p>Showing {visible.length} of {results.length} terms</p>
          <button type="button" className="button" onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, results.length))}>
            Load more terms
          </button>
        </div>
      ) : null}
      <p className="tibetan-browser-privacy">★ Saved terms are stored only in this browser on this device. They do not yet sync with an account or across devices.</p>
    </section>
  )
}
