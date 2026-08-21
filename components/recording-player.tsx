type Props = {
  recordingUrl: string | null
  title: string
}

function youtubeId(url: string) {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] ?? null
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') return parts[1] ?? null
    }
  } catch {
    return null
  }
  return null
}

function googleDriveFileId(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'drive.google.com') return null
    const match = parsed.pathname.match(/\/file\/d\/([^/]+)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

export default function RecordingPlayer({ recordingUrl, title }: Props) {
  if (!recordingUrl) return <p className="meta">Recording coming soon.</p>

  const videoId = youtubeId(recordingUrl)
  const driveId = googleDriveFileId(recordingUrl)
  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0`
    : driveId
      ? `https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`
      : null

  if (!embedUrl) {
    return <a className="button red" href={recordingUrl} target="_blank" rel="noreferrer">Open recording</a>
  }

  return (
    <div>
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', overflow: 'hidden', borderRadius: 18, background: 'var(--ink)' }}>
        <iframe
          src={embedUrl}
          title={`${title} recording`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      </div>
      <div className="actions"><a className="button" href={recordingUrl} target="_blank" rel="noreferrer">Open recording in a new tab</a></div>
    </div>
  )
}
