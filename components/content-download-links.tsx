type DownloadContent = 'transcript' | 'notes'

type Props = {
  collection: 'course8' | 'living-lam-rim' | 'perfection'
  sessionId: string
  content: DownloadContent
}

function href(collection: Props['collection'], sessionId: string, content: DownloadContent, format: 'txt' | 'docx') {
  const params = new URLSearchParams({ collection, session: sessionId, content, format })
  return `/downloads?${params.toString()}`
}

export default function ContentDownloadLinks({ collection, sessionId, content }: Props) {
  return (
    <div className="content-download-links" aria-label={`Download ${content}`}>
      <span>Download:</span>
      <a href={href(collection, sessionId, content, 'txt')}>TXT</a>
      <span aria-hidden="true">·</span>
      <a href={href(collection, sessionId, content, 'docx')}>DOCX</a>
    </div>
  )
}
