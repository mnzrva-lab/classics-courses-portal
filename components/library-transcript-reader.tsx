import MarkdownContent from '@/components/markdown-content'
import type { PerfectionTranscriptChapter } from '@/content/perfection-of-wisdom/transcripts'

/**
 * Common transcript layout pilot.
 * The original speaker field marks a new speaker turn. Empty fields mean
 * the existing speaker continues, not an unknown speaker or a new turn.
 */
export default function LibraryTranscriptReader({
  chapters,
}: {
  chapters: PerfectionTranscriptChapter[]
}) {
  let currentSpeaker = ''

  return (
    <article className="transcript-v12-card" aria-label="Reference transcript">
      {chapters.map((chapter) => (
        <section key={chapter.id} id={chapter.id} style={{ scrollMarginTop: 96, marginBottom: 34 }}>
          <h3>{chapter.title.replace(/[*_`]/g, '')}</h3>
          {chapter.paragraphs.map((paragraph) => {
            const announcedSpeaker = paragraph.speaker.trim().replace(/[:：]\s*$/, '')
            const newTurn = Boolean(announcedSpeaker) && announcedSpeaker !== currentSpeaker
            if (announcedSpeaker) currentSpeaker = announcedSpeaker

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
              </div>
            )
          })}
        </section>
      ))}
    </article>
  )
}
