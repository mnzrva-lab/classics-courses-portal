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
  const total = seconds > 0 && seconds < 1 ? 1 : Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}


type ParagraphTime = { seconds: number; estimated: boolean }

/**
 * The lightweight source keeps unmatched paragraphs as null. For navigation,
 * interpolate their approximate start between adjacent SRT-backed anchors.
 * The estimate is never written back to the transcript source as a verified cue.
 */
function approximateParagraphTimes(transcript: ACI17PreviewTranscript): Map<string, ParagraphTime> {
  const paragraphs = transcript.chapters.flatMap(chapter => chapter.paragraphs)
  const result = new Map<string, ParagraphTime>()
  const weight = (text: string) => Math.max(80, text.replace(/\s/g, '').length)

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index]
    if (paragraph.startSeconds !== null) {
      result.set(paragraph.id, {
        seconds: paragraph.startSeconds,
        estimated: paragraph.timingSource === 'estimated',
      })
      continue
    }

    let before = index - 1
    let after = index + 1
    while (before >= 0 && paragraphs[before].startSeconds === null) before -= 1
    while (after < paragraphs.length && paragraphs[after].startSeconds === null) after += 1

    let seconds = 0
    if (before >= 0 && after < paragraphs.length) {
      // Spoken-text length is a rough proxy for the relative time occupied by
      // each paragraph. The source timestamps remain the bounding anchors.
      let totalWeight = 0
      let elapsedWeight = 0
      for (let i = before; i < after; i += 1) {
        const partWeight = weight(paragraphs[i].text)
        totalWeight += partWeight
        if (i < index) elapsedWeight += partWeight
      }
      const start = paragraphs[before].startSeconds as number
      const end = paragraphs[after].startSeconds as number
      seconds = start + (end - start) * (elapsedWeight / totalWeight)
    } else if (before >= 0) {
      // An unmatched closing passage stays at the last known point rather
      // than creating a fabricated timestamp beyond the recording.
      seconds = paragraphs[before].startSeconds as number
    } else if (after < paragraphs.length) {
      // Some corrected introductions precede the first available SRT cue.
      seconds = Math.max(0, (paragraphs[after].startSeconds as number) - (after - index))
    }
    result.set(paragraph.id, { seconds: Math.max(0, Number(seconds.toFixed(2))), estimated: true })
  }
  return result
}

/**
 * The start of a chapter follows the first timed passage within it.
 * Corrected introductory speech may have no match in the SRT, so the first
 * paragraph itself need not be timed. Preserve the chapter's explicit anchor
 * if provided, and never borrow a timestamp from a different chapter.
 */
function chapterStartTime(
  chapter: ACI17PreviewTranscript['chapters'][number],
  paragraphTimes: Map<string, ParagraphTime>,
): number | null {
  // A chapter begins where its first displayed paragraph begins, including
  // an explicitly marked estimate if that opening has no SRT match.
  return paragraphTimes.get(chapter.paragraphs[0].id)?.seconds
    ?? chapter.paragraphs.find(paragraph => paragraph.startSeconds !== null)?.startSeconds
    ?? chapter.startSeconds
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
  const paragraphTimes = useMemo(() => approximateParagraphTimes(transcript), [transcript])

  const chapters = useMemo(() => transcript.chapters.map((chapter) => {
    const start = chapterStartTime(chapter, paragraphTimes)
    return { id: chapter.id, label: start === null ? chapter.title : `${formatTimestamp(start)} · ${chapter.title}` }
  }), [transcript, paragraphTimes])

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

      <TranscriptControls chapters={chapters} />

      <article className="transcript-v12-card timed-transcript-card aci17-timed-transcript" data-library-transcript="true" aria-label="ACI 17 reference transcript">
        <TranscriptCiteActivation />
        <TranscriptSearchHighlights />
        {transcript.chapters.map((chapter) => {
          let currentSpeaker = ''
          const chapterTitle = chapter.title.replace(/[*_`]/g, '')
          const chapterTime = chapterStartTime(chapter, paragraphTimes)
          const chapterEstimated = paragraphTimes.get(chapter.paragraphs[0].id)?.estimated ?? false
          return (
            <section key={chapter.id} className="aci17-timed-chapter-group" aria-labelledby={`heading-${chapter.id}`}>
              <div className="timed-transcript-chapter" id={chapter.id} style={{ scrollMarginTop: 96 }}>
                {chapterTime !== null ? (
                  <button type="button" className={`timed-chapter-time${chapterEstimated ? ' aci17-estimated' : ''}`} data-transcript-seek={chapterTime} aria-label={`Play from chapter ${formatTimestamp(chapterTime)}`}>
                    {formatTimestamp(chapterTime)}
                  </button>
                ) : null}
                <div className="timed-chapter-title"><h3 id={`heading-${chapter.id}`}>{chapterTitle}</h3></div>
              </div>
              {chapter.paragraphs.map((paragraph, paragraphIndex) => {
                // If an untimed introduction precedes the very first SRT cue,
                // the near-zero cue must not masquerade as the start of the
                // second paragraph in the *complete* corrected transcript.
                const unalignedStartCue = paragraphIndex > 0 &&
                  chapter.paragraphs[0].startSeconds === null &&
                  paragraph.startSeconds !== null && paragraph.startSeconds < 1
                const timing = paragraphTimes.get(paragraph.id)
                const paragraphTime = timing?.seconds ?? 0
                const estimated = Boolean(timing?.estimated || unalignedStartCue)
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
                      <button
                        type="button"
                        className={`transcript-timestamp timed-transcript-time${estimated ? ' aci17-estimated' : ''}`}
                        data-transcript-seek={paragraphTime}
                        aria-label={`${estimated ? 'Estimated position' : 'Play near this passage'} at ${formatTimestamp(paragraphTime)}`}
                        title={estimated ? 'Approximate position based on nearby recording cues' : 'Play from this paragraph'}
                      >{formatTimestamp(paragraphTime)}</button>
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