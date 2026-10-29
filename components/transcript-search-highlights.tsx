'use client'

import { useEffect } from 'react'
import { matchRanges, type MatchMode } from '@/lib/search-match'

/** Mark matching words in rendered transcripts without editing the original source. */
export default function TranscriptSearchHighlights() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const query = params.get('highlight')?.trim()
    if (!query) return
    const mode: MatchMode = params.get('match') === 'all' ? 'all' : 'phrase'
    const marks: HTMLElement[] = []
    const paragraphs = document.querySelectorAll<HTMLElement>('[data-transcript-paragraph] .transcript-copy')

    for (const paragraph of paragraphs) {
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.textContent?.trim() || node.parentElement?.closest('mark, a, button, code, script, style')) return NodeFilter.FILTER_REJECT
          return NodeFilter.FILTER_ACCEPT
        },
      })
      const nodes: Text[] = []
      while (walker.nextNode()) nodes.push(walker.currentNode as Text)
      for (const node of nodes) {
        const source = node.data
        const ranges = matchRanges(source, query, mode)
        if (!ranges.length) continue
        const fragment = document.createDocumentFragment()
        let last = 0
        for (const range of ranges) {
          if (range.start > last) fragment.appendChild(document.createTextNode(source.slice(last, range.start)))
          const mark = document.createElement('mark')
          mark.className = 'transcript-find-mark'
          mark.textContent = source.slice(range.start, range.end)
          fragment.appendChild(mark)
          marks.push(mark)
          last = range.end
        }
        if (last < source.length) fragment.appendChild(document.createTextNode(source.slice(last)))
        node.replaceWith(fragment)
      }
    }

    return () => {
      for (const mark of marks) {
        if (!mark.isConnected) continue
        const parent = mark.parentNode
        mark.replaceWith(document.createTextNode(mark.textContent ?? ''))
        parent?.normalize()
      }
    }
  }, [])
  return null
}
