'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import CopyReference from '@/components/copy-reference'

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
function clip(text: string, length = 320) {
  const cleaned = text.replace(/\s+/g, ' ').replace(/[*_`]/g, '').trim()
  return cleaned.length > length ? `${cleaned.slice(0, length).trim()}…` : cleaned
}
function highlight(text: string, query: string) {
  const terms = Array.from(new Set(query.trim().split(/\s+/).filter(Boolean))).sort((a, b) => b.length - a.length)
  if (!terms.length) return text
  const pieces: Array<{ text: string; match: boolean }> = []
  const lower = text.toLocaleLowerCase()
  let i = 0
  while (i < text.length) {
    const term = terms.find((word) => lower.startsWith(word.toLocaleLowerCase(), i))
    if (term) {
      pieces.push({ text: text.slice(i, i + term.length), match: true })
      i += term.length
    } else {
      const start = i++
      while (i < text.length && !terms.some((word) => lower.startsWith(word.toLocaleLowerCase(), i))) i++
      pieces.push({ text: text.slice(start, i), match: false })
    }
  }
  return pieces.map((piece, index) => piece.match
    ? <mark className="search-query-mark" key={index}>{piece.text}</mark>
    : <Fragment key={index}>{piece.text}</Fragment>)
}

export default function SearchResultList({ results, query }: { results: TeachingSearchResult[]; query: string }) {
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
  useEffect(() => { setCount(PAGE_SIZE) }, [query])
  return <>
    {results.slice(0, count).map((result) => {
      const [base, anchor] = result.href.split('#')
      const path = result.contentType === 'Recording' ? result.href : `${base}${base.includes('?') ? '&' : '?'}highlight=${encodeURIComponent(query)}${anchor ? `#${anchor}` : ''}`
      return <article className="search-result-row" key={`${result.sourceId}-${result.contentType}-${result.id}`}>
        <div className="meta"><span className="search-result-source">{highlight(result.sourceLabel, query)}</span> · {highlight(result.contextLabel, query)} · {highlight(result.sessionLabel, query)} · {result.contentType}{result.chapter ? <> · {highlight(result.chapter, query)}</> : null}</div>
        <div className="search-result-copy">{result.speaker ? <strong>{highlight(result.speaker, query)}: </strong> : null}{highlight(clip(result.body), query)}</div>
        <div className="actions"><Link className="button" href={path}>Open {result.contentType === 'Transcript' ? 'passage' : result.contentType === 'Study Notes' ? 'Study Notes' : 'recording'}</Link><CopyReference reference={result.reference} path={result.href} /></div>
      </article>
    })}
    {count < results.length ? <div ref={sentinel} className="search-result-count-note">Showing {Math.min(count, results.length)} of {results.length} results. <button className="button" type="button" onClick={() => setCount((current) => Math.min(current + PAGE_SIZE, results.length))}>Show more</button></div> : null}
  </>
}
