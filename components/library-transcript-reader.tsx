import CopyReference from '@/components/copy-reference'
import TranscriptSearchHighlights from '@/components/transcript-search-highlights'
import TranscriptCiteActivation from '@/components/transcript-cite-activation'
import TranscriptReaderShell from '@/components/transcript-reader-shell'
import MarkdownContent from '@/components/markdown-content'

export type LibraryTranscriptChapter = {
  id: string
  title: string
  paragraphs: Array<{ id: string; speaker?: string | null; text: string; startSeconds?: number | null; timingSource?: 'youtube-caption' | 'estimated' }>
}

type Props = {
  chapters: LibraryTranscriptChapter[]
  programTitle: string
  sessionTitle: string
  sessionDate: string
  sessionPath: string
}

function validTime(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function formatTimestamp(seconds: number) {
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/**
 * The shared teaching-transcript layout. Spoken text and stable paragraph IDs
 * come from the source. Reading controls are identical whether or not the
 * source contains YouTube timing information.
 */
export default function LibraryTranscriptReader({
  chapters,
  programTitle,
  sessionTitle,
  sessionDate,
  sessionPath,
}: Props) {
  const hasParagraphTimes = chapters.some(chapter =>
    chapter.paragraphs.some(paragraph => validTime(paragraph.startSeconds)),
  )

  const chapterOptions = chapters.map(chapter => {
    const firstTime = chapter.paragraphs[0]?.startSeconds
    const chapterTitle = chapter.title.replace(/[*_`]/g, '')
    return {
      id: chapter.id,
      label: validTime(firstTime) ? `${formatTimestamp(firstTime)} · ${chapterTitle}` : chapterTitle,
    }
  })

  return (
    <TranscriptReaderShell chapters={chapterOptions} hasParagraphTimes={hasParagraphTimes}>
      <article className="transcript-v12-card library-transcript-reader" aria-label="Reference transcript" data-library-transcript="true">
        <TranscriptCiteActivation />
        <TranscriptSearchHighlights />
        {chapters.map(chapter => {
          let currentSpeaker = ''
          const chapterTitle = chapter.title.replace(/[*_`]/g, '')
          const firstTime = chapter.paragraphs[0]?.startSeconds
          return (
            <section key={chapter.id} className="library-standard-chapter" style={{ scrollMarginTop: 96, marginBottom: 34 }}>
              <div
                className={`timed-transcript-chapter${validTime(firstTime) ? '' : ' library-untimed-chapter'}`}
                id={chapter.id}
                style={{ scrollMarginTop: 96 }}
              >
                {validTime(firstTime) ? (
                  <button type="button" className="timed-chapter-time" data-transcript-seek={firstTime} aria-label={`Play chapter from ${formatTimestamp(firstTime)}`}>
                    {formatTimestamp(firstTime)}
                  </button>
                ) : null}
                <div className="timed-chapter-title"><h3>{chapterTitle}</h3></div>
              </div>
              {chapter.paragraphs.map(paragraph => {
                const announcedSpeaker = (paragraph.speaker ?? '').trim().replace(/[:：]\s*$/, '')
                const newTurn = Boolean(announcedSpeaker) && announcedSpeaker !== currentSpeaker
                if (announcedSpeaker) currentSpeaker = announcedSpeaker
                const paragraphTime = validTime(paragraph.startSeconds) ? paragraph.startSeconds : null
                const isEstimated = paragraph.timingSource === 'estimated'
                const reference = [
                  currentSpeaker ? `Speaker: ${currentSpeaker}` : null,
                  programTitle,
                  sessionTitle,
                  sessionDate,
                  chapterTitle,
                  'Reference Transcript',
                  `Paragraph ${paragraph.id}`,
                ].filter(Boolean).join(' · ')

                return (
                  <div
                    className="transcript-paragraph-v12 timed-transcript-paragraph"
                    id={paragraph.id}
                    key={paragraph.id}
                    data-transcript-paragraph
                    data-transcript-speaker={currentSpeaker}
                    style={{ scrollMarginTop: 96 }}
                  >
                    <div className="transcript-copy timed-transcript-copy">
                      {paragraphTime !== null ? (
                        <button
                          type="button"
                          className="transcript-timestamp timed-transcript-time"
                          data-transcript-seek={paragraphTime}
                          aria-label={`Play near this passage from ${isEstimated ? 'approximately ' : ''}${formatTimestamp(paragraphTime)}`}
                        >{isEstimated ? '~ ' : ''}{formatTimestamp(paragraphTime)}</button>
                      ) : null}
                      <div className="timed-transcript-html">
                        <MarkdownContent
                          content={paragraph.text}
                          paragraphPrefix={newTurn ? <strong className="transcript-inline-speaker">{currentSpeaker}: </strong> : undefined}
                        />
                      </div>
                    </div>
                    <div className="passage-study-tools library-transcript-cite">
                      <CopyReference reference={reference} path={`${sessionPath}#${paragraph.id}`} quoteFromSelection />
                    </div>
                  </div>
                )
              })}
            </section>
          )
        })}
      </article>
    </TranscriptReaderShell>
  )
}
