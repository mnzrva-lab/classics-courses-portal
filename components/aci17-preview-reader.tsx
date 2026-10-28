import CopyReference from '@/components/copy-reference'
import TranscriptCiteActivation from '@/components/transcript-cite-activation'
import TranscriptSearchHighlights from '@/components/transcript-search-highlights'
import MarkdownContent from '@/components/markdown-content'
import type { ACI17PreviewTranscript } from '@/lib/aci17-preview-transcript'

function formatTime(seconds: number) {
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function ACI17PreviewReader({
  transcript, sessionTitle, sessionDate, sessionPath,
}: {
  transcript: ACI17PreviewTranscript
  sessionTitle: string
  sessionDate: string
  sessionPath: string
}) {
  return (
    <article className="transcript-v12-card library-transcript-reader aci17-preview-reader" data-library-transcript="true" aria-label="ACI 17 reference transcript">
      <TranscriptCiteActivation />
      <TranscriptSearchHighlights />
      <p className="library-cite-touch-hint">Tap a paragraph to cite it. Select words to include them in the citation.</p>
      {transcript.chapters.map((chapter) => {
        let currentSpeaker = ''
        const title = chapter.title.replace(/[*_`]/g, '')
        return (
          <section key={chapter.id} id={chapter.id} className="aci17-preview-chapter" style={{ scrollMarginTop: 96, marginBottom: 32 }}>
            <div className="aci17-preview-chapter-top">
              <h3>{title}</h3>
              {chapter.startSeconds !== null ? (
                <button type="button" className="aci17-preview-time aci17-preview-chapter-time" data-transcript-seek={chapter.startSeconds} aria-label={`Play video near chapter ${title}, ${formatTime(chapter.startSeconds)}`}>
                  {formatTime(chapter.startSeconds)}
                </button>
              ) : <span className="aci17-preview-missing-time" title="Chapter start time requires review">Time pending</span>}
            </div>
            {chapter.paragraphs.map((paragraph) => {
              const announced = paragraph.speaker.trim().replace(/[:：]\s*$/, '')
              const newTurn = Boolean(announced) && announced !== currentSpeaker
              if (announced) currentSpeaker = announced
              const reference = [
                currentSpeaker ? `Speaker: ${currentSpeaker}` : null,
                'Classic ACI 17', sessionTitle, sessionDate, title,
                'Reference Transcript', `Paragraph ${paragraph.id}`,
              ].filter(Boolean).join(' · ')
              const passageAnchor = `paragraph-${paragraph.id}`
              return (
                <div key={paragraph.id} id={passageAnchor} data-transcript-paragraph data-transcript-speaker={currentSpeaker}
                  className="transcript-paragraph-v12 timed-transcript-paragraph aci17-preview-paragraph"
                  style={{ scrollMarginTop: 96 }}>
                  <div className="transcript-copy aci17-preview-copy">
                    <div className="aci17-preview-time-column">
                      {paragraph.startSeconds !== null ? (
                        <button type="button" className="transcript-timestamp aci17-preview-time" data-transcript-seek={paragraph.startSeconds}
                          aria-label={`Play recording near this paragraph at ${formatTime(paragraph.startSeconds)}`}>
                          {formatTime(paragraph.startSeconds)}
                        </button>
                      ) : <span className="aci17-preview-missing-time" title="Timestamp needs review">—</span>}
                    </div>
                    <div className="aci17-preview-spoken">
                      <MarkdownContent content={paragraph.text} paragraphPrefix={newTurn ? (
                        <strong className="transcript-inline-speaker">{currentSpeaker}: </strong>
                      ) : undefined} />
                    </div>
                  </div>
                  <div className="passage-study-tools library-transcript-cite">
                    <CopyReference reference={reference} path={`${sessionPath}#${passageAnchor}`} quoteFromSelection />
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