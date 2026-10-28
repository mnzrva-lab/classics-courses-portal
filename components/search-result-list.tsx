'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import CopyReference from '@/components/copy-reference'
import { matchRanges, type MatchMode } from '@/lib/search-match'

export type TeachingSearchResult = {
  id: string
  sourceId: string
  sourceLabel: string
  contextLabel: string
  sessionLabel: string
  sessionKind: string
  teacher: string
  contentType: 'Transcript' | 'Study Notes' | 'Recording'
  chapter?: string
  speaker?: string
  body: string
  href: string
  score: number
  reference: string
}

const PAGE_SIZE = 25

function excerpt(text: string, query: string, mode: MatchMode, length = 340) {
  const cleaned = text.replace(/\s+/g, ' ').replace(/[*_`]/g, '').trim()
  if (cleaned.length <= length) return cleaned
  const first = matchRanges(cleaned, query, mode)[0]
  const start = first ? Math.max(0, Math.min(cleaned.length - length, first.start - 90)) : 0
  const end = Math.min(cleaned.length, start + length)
  return (start ? '…' : '') + cleaned.slice(start, end).trim() + (end < cleaned.length ? '…' : '')
}

function highlight(text: string, query: string, mode: MatchMode) {
  const ranges = matchRanges(text, query, mode)
  if (!ranges.length) return text
  const nodes: React.ReactNode[] = []
  let from = 0
  ranges.forEach((range, index) => {
    if (range.start > from) nodes.push(<Fragment key={'text-' + index}>{text.slice(from, range.start)}</Fragment>)
    nodes.push(<mark className="search-query-mark" key={'match-' + index}>{text.slice(range.start, range.end)}</mark>)
    from = range.end
  })
  if (from < text.length) nodes.push(<Fragment key="trailing">{text.slice(from)}</Fragment>)
  return nodes
}

export default function SearchResultList({ results, query, mode }: { results: TeachingSearchResult[]; query: string; mode: MatchMode }) {
  const [count, setCount] = useState(PAGE_SIZE)
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (count >= results.length) return
    const node = sentinel.current
    if (!node || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setCount((current) => Math.min(current + PAGE_SIZE, results.length))
    }, { rootMargin: '500px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [count, results.length])
  useEffect(() => { setCount(PAGE_SIZE) }, [query, mode])
  return <>
    {results.slice(0, count).map((result) => {
      const [base, anchor] = result.href.split('#')
      const path = result.contentType === 'Recording' ? result.href : `${base}${base.includes('?') ? '&' : '?'}highlight=${encodeURIComponent(query)}${mode === 'all' ? '&match=all' : ''}${anchor ? `#${anchor}` : ''}`
      return <article className="search-result-row" key={`${result.sourceId}-${result.contentType}-${result.id}`}>
        <div className="meta"><span className="search-result-source">{highlight(result.sourceLabel, query, mode)}</span> · {highlight(result.contextLabel, query, mode)} · {highlight(result.sessionLabel, query, mode)} · {result.contentType}{result.chapter ? <> · {highlight(result.chapter, query, mode)}</> : null}</div>
        <div className="search-result-copy">{result.speaker ? <strong>{highlight(result.speaker, query, mode)}: </strong> : null}{highlight(excerpt(result.body, query, mode), query, mode)}</div>
        <div className="actions"><Link className="button" href={path}>Open {result.contentType === 'Transcript' ? 'passage' : result.contentType === 'Study Notes' ? 'Study Notes' : 'recording'}</Link><CopyReference reference={result.reference} path={result.href} /></div>
      </article>
    })}
    {count < results.length ? <div ref={sentinel} className="search-result-count-note">Showing {Math.min(count, results.length)} of {results.length} results. <button className="button" type="button" onClick={() => setCount((current) => Math.min(current + PAGE_SIZE, results.length))}>Show more</button></div> : null}
  </>
}
