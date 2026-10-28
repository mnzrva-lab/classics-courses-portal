'use client'

import { useEffect } from 'react'

/**
 * Highlights a search term after opening an exact passage from the results.
 * Text nodes only: never rewrite the transcript source, paragraph IDs or links.
 */
export default function TranscriptSearchHighlights() {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get('highlight')?.trim()
    if (!query) return
    const terms = Array.from(new Set(query.split(/\s+/).filter(Boolean))).sort((a, b) => b.length - a.length)
    if (!terms.length) return
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
        const original = node.data
        const lower = original.toLocaleLowerCase()
        const fragment = document.createDocumentFragment()
        let offset = 0
        let found = false
        while (offset < original.length) {
          const term = terms.find((item) => lower.startsWith(item.toLocaleLowerCase(), offset))
          if (term) {
            const mark = document.createElement('mark')
            mark.className = 'transcript-find-mark'
            mark.textContent = original.slice(offset, offset + term.length)
            fragment.appendChild(mark)
            marks.push(mark)
            found = true
            offset += term.length
          } else {
            let end = offset + 1
            while (end < original.length && !terms.some((item) => lower.startsWith(item.toLocaleLowerCase(), end))) end++
            fragment.appendChild(document.createTextNode(original.slice(offset, end)))
            offset = end
          }
        }
        if (found) node.replaceWith(fragment)
      }
    }
    return () => {
      for (const mark of marks) {
        if (mark.isConnected) {
          const parent = mark.parentNode
          mark.replaceWith(document.createTextNode(mark.textContent ?? ''))
          parent?.normalize()
        }
      }
    }
  }, [])
  return null
}
