'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import TranscriptControls from '@/components/transcript-controls'
import type { TimedTranscript } from '@/content/classics/timed-transcripts'

type ReaderSize = 'small' | 'medium' | 'large'

function formatTimestamp(ms: number | null) {
  if (ms == null) return ''
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function textFromHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function TimedArchiveTranscript({ transcript }: { transcript: TimedTranscript }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [showJumpBack, setShowJumpBack] = useState(false)
  const [readerSize, setReaderSize] = useState<ReaderSize>('medium')
  const [showParagraphTimes, setShowParagraphTimes] = useState(false)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  const chapters = useMemo(() => transcript.paragraphs
    .filter((paragraph) => paragraph.isChapter && paragraph.startMs != null)
    .map((paragraph) => ({
      id: `chapter-${paragraph.id}`,
      label: `${formatTimestamp(paragraph.startMs)} · ${textFromHtml(paragraph.html)}`,
    })), [transcript])

  const disclaimer = transcript.paragraphs.find((paragraph) => paragraph.status === 'skipped' && /reference only/i.test(paragraph.html))
  const readable = transcript.paragraphs.filter((paragraph) => paragraph.status !== 'skipped')

  useEffect(() => {
    try {
      const savedSize = window.localStorage.getItem('tdl-transcript-text-size')
      const savedTimes = window.localStorage.getItem('tdl-transcript-show-paragraph-times')
      if (savedSize === 'small' || savedSize === 'medium' || savedSize === 'large') setReaderSize(savedSize)
      if (savedTimes === 'true') setShowParagraphTimes(true)
    } catch {}
    setPreferencesLoaded(true)
  }, [])

  useEffect(() => {
    if (!preferencesLoaded) return
    try {
      window.localStorage.setItem('tdl-transcript-text-size', readerSize)
      window.localStorage.setItem('tdl-transcript-show-paragraph-times', String(showParagraphTimes))
    } catch {}
  }, [readerSize, showParagraphTimes, preferencesLoaded])

  useEffect(() => {
    function update() {
      const root = rootRef.current
      if (!root) return
      setShowJumpBack(root.getBoundingClientRect().top < -320)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  function jumpToTranscript() {
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function jumpToVideo() {
    document.getElementById('recording')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      ref={rootRef}
      className={`timed-transcript-root reader-size-${readerSize}${showParagraphTimes ? ' show-paragraph-times' : ''}`}
      style={{ scrollMarginTop: 96 }}
    >
      {disclaimer ? (
        <div className="info-callout timed-transcript-disclaimer" dangerouslySetInnerHTML={{ __html: disclaimer.html }} />
      ) : null}

      <div className="timed-reader-toolbar" aria-label="Transcript reading settings">
        <div className="timed-reader-size">
          <span className="timed-reader-label">Text</span>
          <div className="timed-reader-segment" role="group" aria-label="Transcript text size">
            <button type="button" className={readerSize === 'small' ? 'active' : ''} onClick={() => setReaderSize('small')} aria-pressed={readerSize === 'small'} aria-label="Smaller transcript text">A−</button>
            <button type="button" className={readerSize === 'medium' ? 'active' : ''} onClick={() => setReaderSize('medium')} aria-pressed={readerSize === 'medium'} aria-label="Default transcript text">A</button>
            <button type="button" className={readerSize === 'large' ? 'active' : ''} onClick={() => setReaderSize('large')} aria-pressed={readerSize === 'large'} aria-label="Larger transcript text">A+</button>
          </div>
        </div>
        <button
          className={showParagraphTimes ? 'timed-reader-times active' : 'timed-reader-times'}
          type="button"
          onClick={() => setShowParagraphTimes((value) => !value)}
          aria-pressed={showParagraphTimes}
        >
          {showParagraphTimes ? 'Hide paragraph times' : 'Show paragraph times'}
        </button>
      </div>

      <div className="timed-transcript-helper meta">
        Chapter times stay visible for navigation. Turn on paragraph times when you want to jump near a specific passage.
      </div>
      <TranscriptControls chapters={chapters} />

      <article className="transcript-v12-card timed-transcript-card">
        {readable.map((paragraph) => {
          const seconds = paragraph.startMs == null ? null : paragraph.startMs / 1000
          const timestamp = formatTimestamp(paragraph.startMs)

          if (paragraph.isChapter) {
            return (
              <section className="timed-transcript-chapter" id={`chapter-${paragraph.id}`} key={paragraph.id} style={{ scrollMarginTop: 96 }}>
                {seconds != null ? (
                  <button className="timed-chapter-time" type="button" data-transcript-seek={seconds} aria-label={`Play from chapter ${timestamp}`}>{timestamp}</button>
                ) : null}
                <div className="timed-chapter-title" dangerouslySetInnerHTML={{ __html: paragraph.html }} />
              </section>
            )
          }

          return (
            <div
              className="transcript-paragraph-v12 timed-transcript-paragraph"
              data-transcript-paragraph
              id={`paragraph-${paragraph.id}`}
              key={paragraph.id}
              style={{ scrollMarginTop: 96 }}
            >
              <div className="transcript-copy timed-transcript-copy">
                {seconds != null ? (
                  <button className="transcript-timestamp timed-transcript-time" type="button" data-transcript-seek={seconds} aria-label={`Play near this passage from ${timestamp}`}>{timestamp}</button>
                ) : null}
                <div className="timed-transcript-html" dangerouslySetInnerHTML={{ __html: paragraph.html }} />
              </div>
            </div>
          )
        })}
      </article>

      {showJumpBack ? (
        <div className="timed-transcript-jump-back" aria-label="Transcript navigation">
          <button type="button" onClick={jumpToTranscript}>↑ Transcript</button>
          <button type="button" onClick={jumpToVideo}>↑ Video</button>
        </div>
      ) : null}
    </div>
  )
}
