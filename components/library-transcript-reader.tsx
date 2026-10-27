import MarkdownContent from '@/components/markdown-content'
import type { PerfectionTranscriptChapter } from '@/content/perfection-of-wisdom/transcripts'

/**
 * Shared transcript layout pilot.
 *
 * A nonempty speaker field marks the start of a speaker turn. Empty fields
 * continue that speaker. Every new chapter starts a fresh display context,
 * so its opening speaker is announced even if the previous chapter ended
 * with the same speaker. No source text or speaker metadata is modified.
 */
export default function LibraryTranscriptReader({
  chapters,
}: {
  chapters: PerfectionTranscriptChapter[]
}) {
  return (
    <article className="transcript-v12-card" aria-label="Reference transcript">
      {chapters.map((chapter) => {
        // Chapter boundaries reset the visible speaker label.
        let currentSpeaker = ''

        return (
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
        )
      })}
    </article>
  )
}
