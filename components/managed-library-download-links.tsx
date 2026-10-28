type Props = {
  programSlug: string
  offeringSlug: string
  sessionSlug: string
  content: 'transcript' | 'notes'
}
export default function ManagedLibraryDownloadLinks({
  programSlug, offeringSlug, sessionSlug, content,
}: Props) {
  const base = '/library/' + programSlug + '/' + offeringSlug + '/' + sessionSlug + '/download'
  const href = (format: 'txt' | 'docx') =>
    base + '?' + new URLSearchParams({ content, format }).toString()
  return (
    <div className="content-download-links" aria-label={'Download ' + content}>
      <span>Download:</span>
      <a href={href('txt')}>TXT</a><span aria-hidden="true">·</span><a href={href('docx')}>DOCX</a>
    </div>
  )
}
