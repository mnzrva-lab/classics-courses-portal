'use client'

import { useState } from 'react'

type Chapter = { id: string; label: string }

export default function TranscriptControls({ chapters }: { chapters: Chapter[] }) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<number | null>(null)

  function filterTranscript(value: string) {
    setQuery(value)
    const normalized = value.trim().toLowerCase()
    const paragraphs = Array.from(document.querySelectorAll<HTMLElement>('[data-transcript-paragraph]'))
    let count = 0
    paragraphs.forEach((element) => {
      const match = !normalized || (element.textContent ?? '').toLowerCase().includes(normalized)
      element.classList.toggle('transcript-search-hidden', !match)
      if (match) count += 1
    })
    setMatches(normalized ? count : null)
  }

  function jump(target: string) {
    if (!target) return
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="transcript-tools-v12">
      <label className="sr-only" htmlFor="transcript-search">Search this transcript</label>
      <div className="transcript-search-wrap">
        <input id="transcript-search" type="search" value={query} onChange={(event) => filterTranscript(event.target.value)} placeholder="Search this transcript" />
        {matches != null ? <span>{matches} match{matches === 1 ? '' : 'es'}</span> : null}
      </div>
      <label className="sr-only" htmlFor="transcript-chapter-jump">Jump to chapter</label>
      <select id="transcript-chapter-jump" defaultValue="" onChange={(event) => jump(event.target.value)}>
        <option value="">Jump to chapter</option>
        {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.label}</option>)}
      </select>
    </div>
  )
}
