'use client'

import { useEffect, useState, type ReactNode } from 'react'
import TranscriptControls from '@/components/transcript-controls'
import TranscriptReaderToolbar, { type TranscriptReaderSize } from '@/components/transcript-reader-toolbar'

type ChapterOption = { id: string; label: string }

type Props = {
  chapters: ChapterOption[]
  hasParagraphTimes: boolean
  children: ReactNode
}

/**
 * One reading toolbar and chapter/search layout for all source-based programs.
 * A program without timing data still has text sizing, search, chapters, and Cite.
 */
export default function TranscriptReaderShell({ chapters, hasParagraphTimes, children }: Props) {
  const [readerSize, setReaderSize] = useState<TranscriptReaderSize>('medium')
  const [showParagraphTimes, setShowParagraphTimes] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const size = window.localStorage.getItem('tdl-transcript-text-size')
      const times = window.localStorage.getItem('tdl-transcript-show-paragraph-times')
      if (size === 'small' || size === 'medium' || size === 'large') setReaderSize(size)
      if (times === 'true') setShowParagraphTimes(true)
    } catch {}
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem('tdl-transcript-text-size', readerSize)
      window.localStorage.setItem('tdl-transcript-show-paragraph-times', String(showParagraphTimes))
    } catch {}
  }, [loaded, readerSize, showParagraphTimes])

  return (
    <div className={`timed-transcript-root unified-transcript-reader reader-size-${readerSize}${hasParagraphTimes && showParagraphTimes ? ' show-paragraph-times' : ''}`}>
      <TranscriptReaderToolbar
        size={readerSize}
        onSizeChange={setReaderSize}
        hasTimes={hasParagraphTimes}
        showTimes={showParagraphTimes}
        onToggleTimes={() => setShowParagraphTimes(value => !value)}
      />
      <TranscriptControls chapters={chapters} />
      {children}
    </div>
  )
}
