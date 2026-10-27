import CopyReference from '@/components/copy-reference'
import MarkdownContent from '@/components/markdown-content'
import type { PerfectionTranscriptChapter } from '@/content/perfection-of-wisdom/transcripts'

type Props = {
  chapters: PerfectionTranscriptChapter[]
  programTitle: string
  sessionTitle: string
  sessionDate: string
  sessionPath: string
}

/**
 * A speaker's name is displayed once per turn and again at every chapter
 * opening. Citations always use the resolved speaker, even in paragraphs where
 * the name is intentionally omitted from the visible transcript.
 */
export default function LibraryTranscriptReader({
  chapters,
  programTitle,
  sessionTitle,
  sessionDate,
  sessionPath,
}: Props) {
  return (
    <article className="transcript-v12-card" aria-label="Reference transcript">
      {chapters.map((chapter) => {
        let currentSpeaker = ''
        const chapterTitle = chapter.title.replace(/[*_`]/g, '')

        return (
          <section key={chapter.id} id={chapter.id} style={{ scrollMarginTop: 96, marginBottom: 34 }}>
            <h3>{chapterTitle}</h3>
            {chapter.paragraphs.map((paragraph) => {
              const announcedSpeaker = paragraph.speaker.trim().replace(/[:：]\s*$/, '')
              const newTurn = Boolean(announcedSpeaker) && announcedSpeaker !== currentSpeaker
              if (announcedSpeaker) currentSpeaker = announcedSpeaker

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
                  className="transcript-paragraph-v12"
                  id={paragraph.id}
                  key={paragraph.id}
                  data-transcript-paragraph
                  data-transcript-speaker={currentSpeaker}
                  style={{ scrollMarginTop: 96 }}
                >
                  <div className="transcript-copy">
                    <MarkdownContent
                      content={paragraph.text}
                      paragraphPrefix={newTurn ? (
                        <strong className="transcript-inline-speaker">{currentSpeaker}: </strong>
                      ) : undefined}
                    />
                  </div>
                  <div className="passage-study-tools library-transcript-cite">
                    <CopyReference reference={reference} path={`${sessionPath}#${paragraph.id}`} />
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </article>
  )
}
