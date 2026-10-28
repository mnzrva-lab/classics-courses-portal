/**
 * Approved, source-preserving notice shown with reference transcripts.
 * Keep the wording identical on every student class page.
 */
export const TRANSCRIPT_NOTICE_TEXT = 'This transcript was created by a student with AI and should be used for reference only. Please check it against the video and audio for accuracy of content.'

export default function TranscriptNotice() {
  return (
    <div className="info-callout transcript-notice">
      <strong>About this transcript</strong><br />
      {TRANSCRIPT_NOTICE_TEXT}
    </div>
  )
}
