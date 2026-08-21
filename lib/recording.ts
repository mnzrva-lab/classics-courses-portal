export function youtubeId(url: string | null | undefined) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] ?? null
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') return parts[1] ?? null
    }
  } catch {
    return null
  }
  return null
}

export function googleDriveFileId(url: string | null | undefined) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'drive.google.com') return null
    const match = parsed.pathname.match(/\/file\/d\/([^/]+)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}
