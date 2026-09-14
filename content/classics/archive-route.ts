import { archiveSessionsFor, type ArchiveSession } from './archive-sessions'

function slugSegment(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function archiveSessionSlug(session: ArchiveSession, index = 0) {
  const videoId = session.videoId?.trim()
  if (videoId) return `video-${videoId}`

  const code = slugSegment(session.code || `session-${index + 1}`)
  const name = slugSegment(session.name).slice(0, 72)
  return [code, name].filter(Boolean).join('-') || `session-${index + 1}`
}

export function archiveSessionBySlug(courseNumber: number, offeringSlug: string, sessionSlug: string) {
  const sessions = archiveSessionsFor(courseNumber, offeringSlug)
  const index = sessions.findIndex((session, sessionIndex) => archiveSessionSlug(session, sessionIndex) === sessionSlug)
  return index === -1 ? null : { session: sessions[index], index, sessions }
}
