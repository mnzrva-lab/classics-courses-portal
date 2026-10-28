'use client'

import { useEffect, useMemo, useState } from 'react'
import TranscriptControls from '@/components/transcript-controls'
import TranscriptReaderToolbar from '@/components/transcript-reader-toolbar'
import TranscriptCiteActivation from '@/components/transcript-cite-activation'
import TranscriptSearchHighlights from '@/components/transcript-search-highlights'
import CopyReference from '@/components/copy-reference'
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

export default function TimedArchiveTranscript({
  transcript, sessionTitle = '', sessionDate = '', sessionPath = '',
}: {
  transcript: TimedTranscript
  sessionTitle?: string
  sessionDate?: string
  sessionPath?: string
}) {
  const [readerSize, setReaderSize] = useState<ReaderSize>('medium')
  const [showParagraphTimes, setShowParagraphTimes] = useState(false)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  const chapters = useMemo(() => transcript.paragraphs
    .filter((paragraph) => paragraph.isChapter)
    .map((paragraph) => ({
      id: `chapter-${paragraph.id}`,
      label: paragraph.startMs == null ? textFromHtml(paragraph.html) : `${formatTimestamp(paragraph.startMs)} · ${textFromHtml(paragraph.html)}`,
    })), [transcript])

  const readable = transcript.paragraphs.filter((paragraph) => paragraph.status !== 'skipped')
  const hasParagraphTimes = readable.some(paragraph => !paragraph.isChapter && paragraph.startMs != null)

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

  return (
    <div
      className={`timed-transcript-root aci17-timed-reader reader-size-${readerSize}${hasParagraphTimes && showParagraphTimes ? ' show-paragraph-times' : ''}`}
      style={{ scrollMarginTop: 96 }}
    >
      <TranscriptReaderToolbar
        size={readerSize}
        onSizeChange={setReaderSize}
        hasTimes={hasParagraphTimes}
        showTimes={showParagraphTimes}
        onToggleTimes={() => setShowParagraphTimes(value => !value)}
      />

      <TranscriptControls chapters={chapters} />

      <article className="transcript-v12-card timed-transcript-card aci17-timed-transcript" data-library-transcript="true" aria-label="Reference transcript">
        <TranscriptCiteActivation />
        <TranscriptSearchHighlights />
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
              className="transcript-paragraph-v12 timed-transcript-paragraph aci17-timed-paragraph"
              data-transcript-paragraph
              data-transcript-speaker={paragraph.speaker}
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
              <div className="aci17-cite-row">
                <CopyReference
                  reference={['Classic ACI 17', sessionTitle, sessionDate, 'Reference Transcript', `Paragraph ${paragraph.id}`].filter(Boolean).join(' · ')}
                  path={`${sessionPath}#paragraph-${paragraph.id}`}
                  quoteFromSelection
                />
              </div>
            </div>
          )
        })}
      </article>


    </div>
  )
}
