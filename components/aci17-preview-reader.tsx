'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import CopyReference from '@/components/copy-reference'
import TranscriptCiteActivation from '@/components/transcript-cite-activation'
import TranscriptControls from '@/components/transcript-controls'
import TranscriptSearchHighlights from '@/components/transcript-search-highlights'
import MarkdownContent from '@/components/markdown-content'
import type { ACI17PreviewTranscript } from '@/lib/aci17-preview-transcript'

type ReaderSize = 'small' | 'medium' | 'large'

function formatTimestamp(seconds: number | null) {
  if (seconds === null) return ''
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * ACI 17 uses the same reader shell, sizing and time-toggle controls as the
 * original timed archive reader. The only input is the lightweight private
 * JSON; the source SRT is not loaded by the browser.
 */
export default function ACI17PreviewReader({
  transcript, sessionTitle, sessionDate, sessionPath,
}: {
  transcript: ACI17PreviewTranscript
  sessionTitle: string
  sessionDate: string
  sessionPath: string
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [showJumpBack, setShowJumpBack] = useState(false)
  const [readerSize, setReaderSize] = useState<ReaderSize>('medium')
  const [showParagraphTimes, setShowParagraphTimes] = useState(false)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  const chapters = useMemo(() => transcript.chapters.map((chapter) => ({
    id: chapter.id,
    label: chapter.startSeconds === null
      ? `${chapter.title} · time pending`
      : `${formatTimestamp(chapter.startSeconds)} · ${chapter.title}`,
  })), [transcript])

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
    function updateJumpBack() {
      const root = rootRef.current
      if (root) setShowJumpBack(root.getBoundingClientRect().top < -320)
    }
    updateJumpBack()
    window.addEventListener('scroll', updateJumpBack, { passive: true })
    window.addEventListener('resize', updateJumpBack)
    return () => {
      window.removeEventListener('scroll', updateJumpBack)
      window.removeEventListener('resize', updateJumpBack)
    }
  }, [])

  return (
    <div
      ref={rootRef}
      className={`timed-transcript-root aci17-timed-reader reader-size-${readerSize}${showParagraphTimes ? ' show-paragraph-times' : ''}`}
      style={{ scrollMarginTop: 96 }}
    >
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
          onClick={() => setShowParagraphTimes(value => !value)}
          aria-pressed={showParagraphTimes}
        >
          {showParagraphTimes ? 'Hide paragraph times' : 'Show paragraph times'}
        </button>
      </div>

      <div className="timed-transcript-helper meta">
        Chapter times stay visible for navigation. Turn on paragraph times when you want to jump near a specific passage.
      </div>
      <TranscriptControls chapters={chapters} />

      <article className="transcript-v12-card timed-transcript-card aci17-timed-transcript" data-library-transcript="true" aria-label="ACI 17 reference transcript">
        <TranscriptCiteActivation />
        <TranscriptSearchHighlights />
        {transcript.chapters.map((chapter) => {
          let currentSpeaker = ''
          const chapterTitle = chapter.title.replace(/[*_`]/g, '')
          return (
            <section key={chapter.id} className="aci17-timed-chapter-group" aria-labelledby={`heading-${chapter.id}`}>
              <div className="timed-transcript-chapter" id={chapter.id} style={{ scrollMarginTop: 96 }}>
                {chapter.startSeconds !== null ? (
                  <button type="button" className="timed-chapter-time" data-transcript-seek={chapter.startSeconds} aria-label={`Play from chapter ${formatTimestamp(chapter.startSeconds)}`}>
                    {formatTimestamp(chapter.startSeconds)}
                  </button>
                ) : (
                  <span className="aci17-time-pending aci17-chapter-pending" title="Chapter start needs timecode verification">Time pending</span>
                )}
                <div className="timed-chapter-title"><h3 id={`heading-${chapter.id}`}>{chapterTitle}</h3></div>
              </div>
              {chapter.paragraphs.map((paragraph) => {
                const announcedSpeaker = paragraph.speaker.trim().replace(/[:：]\s*$/, '')
                const newTurn = Boolean(announcedSpeaker) && announcedSpeaker !== currentSpeaker
                if (announcedSpeaker) currentSpeaker = announcedSpeaker
                const reference = [
                  currentSpeaker ? `Speaker: ${currentSpeaker}` : null,
                  'Classic ACI 17', sessionTitle, sessionDate, chapterTitle,
                  'Reference Transcript', `Paragraph ${paragraph.id}`,
                ].filter(Boolean).join(' · ')
                const paragraphAnchor = `paragraph-${paragraph.id}`
                return (
                  <div
                    className="transcript-paragraph-v12 timed-transcript-paragraph aci17-timed-paragraph"
                    id={paragraphAnchor}
                    key={paragraph.id}
                    data-transcript-paragraph
                    data-transcript-speaker={currentSpeaker}
                    style={{ scrollMarginTop: 96 }}
                  >
                    <div className="transcript-copy timed-transcript-copy">
                      {paragraph.startSeconds !== null ? (
                        <button
                          type="button"
                          className="transcript-timestamp timed-transcript-time"
                          data-transcript-seek={paragraph.startSeconds}
                          aria-label={`Play near this passage from ${formatTimestamp(paragraph.startSeconds)}`}
                        >{formatTimestamp(paragraph.startSeconds)}</button>
                      ) : (
                        <span className="timed-transcript-time aci17-untimed-paragraph" title="Timestamp needs verification">—</span>
                      )}
                      <div className="timed-transcript-html">
                        <MarkdownContent
                          content={paragraph.text}
                          paragraphPrefix={newTurn ? <strong className="transcript-inline-speaker">{currentSpeaker}: </strong> : undefined}
                        />
                      </div>
                    </div>
                    <div className="aci17-cite-row">
                      <CopyReference reference={reference} path={`${sessionPath}#${paragraphAnchor}`} quoteFromSelection />
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })}
      </article>

      {showJumpBack ? (
        <div className="timed-transcript-jump-back" aria-label="Transcript navigation">
          <button type="button" onClick={() => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>↑ Transcript</button>
          <button type="button" onClick={() => document.getElementById('recording')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>↑ Video</button>
        </div>
      ) : null}
    </div>
  )
}