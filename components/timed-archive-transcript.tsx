'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import TranscriptControls from '@/components/transcript-controls'
import type { TimedTranscript } from '@/content/classics/timed-transcripts'

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

  const chapters = useMemo(() => transcript.paragraphs
    .filter((paragraph) => paragraph.isChapter && paragraph.startMs != null)
    .map((paragraph) => ({
      id: `chapter-${paragraph.id}`,
      label: `${formatTimestamp(paragraph.startMs)} · ${textFromHtml(paragraph.html)}`,
    })), [transcript])

  const disclaimer = transcript.paragraphs.find((paragraph) => paragraph.status === 'skipped' && /reference only/i.test(paragraph.html))
  const readable = transcript.paragraphs.filter((paragraph) => paragraph.status !== 'skipped')

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
    <div ref={rootRef} className="timed-transcript-root" style={{ scrollMarginTop: 96 }}>
      {disclaimer ? (
        <div className="info-callout timed-transcript-disclaimer" dangerouslySetInnerHTML={{ __html: disclaimer.html }} />
      ) : null}

      <div className="timed-transcript-helper meta">Click any timestamp to play the recording from that moment. Use Follow playback to keep the current passage highlighted.</div>
      <TranscriptControls chapters={chapters} />

      <article className="transcript-v12-card timed-transcript-card">
        {readable.map((paragraph) => {
          const seconds = paragraph.startMs == null ? null : paragraph.startMs / 1000
          const timestamp = formatTimestamp(paragraph.startMs)

          if (paragraph.isChapter) {
            return (
              <section className="timed-transcript-chapter" id={`chapter-${paragraph.id}`} key={paragraph.id} style={{ scrollMarginTop: 96 }}>
                {seconds != null ? (
                  <button className="timed-chapter-time" type="button" data-transcript-seek={seconds} aria-label={`Play from ${timestamp}`}>{timestamp}</button>
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
                  <button className="transcript-timestamp timed-transcript-time" type="button" data-transcript-seek={seconds} aria-label={`Play from ${timestamp}`}>{timestamp}</button>
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
