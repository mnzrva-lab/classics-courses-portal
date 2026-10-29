import 'server-only'
import { cache } from 'react'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'
import rawCourse17 from '@/content/classics/archive-sessions/course-17.json'
import type { ArchiveSession } from '@/content/classics/archive-sessions'
import { readPublishedJSON, type PublishedJsonPath } from '@/lib/public-content'

export type ACI17Paragraph = {
  id: string
  speaker: string
  text: string
  startSeconds: number | null
  timingSource?: 'youtube-caption' | 'estimated'
  youtubeCueLine?: number
}
export type ACI17Chapter = {
  id: string
  title: string
  startSeconds: number | null
  paragraphs: ACI17Paragraph[]
}
export type ACI17Transcript = {
  schemaVersion: 1
  sessionId: string
  youtubeVideoId: string
  timingStatus: 'youtube-caption-aligned'
  chapters: ACI17Chapter[]
}
export type ACI17Manifest = {
  schemaVersion: 1
  course: 17
  slug: 'course-17'
  title: string
  artwork?: string
  artworkAlt?: string
  offering: {
    slug: 'current-2026'
    label: string
    sourceLabel: string
    playlistUrl: string
    sessions: ArchiveSession[]
  }
}
export type ACI17CorpusItem = {
  session: ArchiveSession
  index: number
  transcript: ACI17Transcript | null
}
export type ACI17Corpus = {
  manifest: ACI17Manifest
  items: ACI17CorpusItem[]
}

const localCatalog = (rawCatalog as Array<{ canonicalNumber: number; title: string; artwork?: string; artworkAlt?: string }>).find(c => c.canonicalNumber === 17)
const localOffering = (rawArchiveCatalog as {
  courses: Array<{ canonicalNumber: number; offerings?: Array<{ slug: string; label: string; sourceLabel: string; playlistUrl?: string }> }>
}).courses.find(c => c.canonicalNumber === 17)?.offerings?.find(o => o.slug === 'current-2026')

/** Existing verified public recording metadata is the network-failure fallback. */
const fallback: ACI17Manifest = {
  schemaVersion: 1,
  course: 17,
  slug: 'course-17',
  title: localCatalog?.title ?? 'The Great Ideas of Buddhism, Part II',
  artwork: localCatalog?.artwork,
  artworkAlt: localCatalog?.artworkAlt,
  offering: {
    slug: 'current-2026',
    label: localOffering?.label ?? 'Arizona 2026',
    sourceLabel: localOffering?.sourceLabel ?? 'Arizona · 2026',
    playlistUrl: localOffering?.playlistUrl ?? 'https://www.youtube.com/playlist?list=PLTqjBtjd9j8eoKAvtmWAVOGvv8_iwgNu6',
    sessions: (rawCourse17 as { offerings: Record<string, { sessions: ArchiveSession[] }> }).offerings['current-2026'].sessions,
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function nonempty(value: unknown, limit = 25000): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && value.length <= limit
}
function validYouTubeLink(link: unknown, videoId: string): boolean {
  if (typeof link !== 'string') return false
  try {
    const url = new URL(link)
    const short = url.hostname === 'youtu.be' && url.pathname === '/' + videoId
    const long = ['youtube.com', 'www.youtube.com'].includes(url.hostname) &&
      url.pathname === '/watch' && url.searchParams.get('v') === videoId
    return url.protocol === 'https:' && (short || long)
  } catch { return false }
}
function isManifest(value: unknown): value is ACI17Manifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.course !== 17 ||
    value.slug !== 'course-17' || !nonempty(value.title, 200) || !isRecord(value.offering)) return false
  const offering = value.offering
  if (offering.slug !== 'current-2026' || !nonempty(offering.label, 200) ||
    !nonempty(offering.sourceLabel, 200) ||
    !Array.isArray(offering.sessions) || offering.sessions.length !== 10) return false
  if (value.artwork !== undefined &&
    (typeof value.artwork !== 'string' || !/^\/images\/[a-zA-Z0-9/_-]+\.(webp|png|jpg|jpeg)$/.test(value.artwork))) return false
  if (value.artworkAlt !== undefined && !nonempty(value.artworkAlt, 300)) return false
  try {
    const url = new URL(String(offering.playlistUrl))
    if (url.protocol !== 'https:' ||
        !['youtube.com', 'www.youtube.com'].includes(url.hostname) ||
        url.pathname !== '/playlist' || !url.searchParams.get('list')) return false
  } catch { return false }
  const videoIds = new Set<string>()
  for (const [index, session] of offering.sessions.entries()) {
    if (!isRecord(session) || session.code !== 'C' + (index + 1) ||
      !nonempty(session.name, 200) || !nonempty(session.date, 80) ||
      !nonempty(session.duration, 40) ||
      typeof session.videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(session.videoId) ||
      videoIds.has(session.videoId) || !validYouTubeLink(session.url, session.videoId)) return false
    videoIds.add(session.videoId)
    if (session.teacher !== undefined && !nonempty(session.teacher, 200)) return false
    if (session.sourceTitle !== undefined && !nonempty(session.sourceTitle, 500)) return false
  }
  return true
}
function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 21600
}
function isTranscript(value: unknown, sessionCode: string, videoId: string): value is ACI17Transcript {
  if (!isRecord(value)) return false
  const padded = String(Number(sessionCode.slice(1))).padStart(2, '0')
  if (value.schemaVersion !== 1 || value.sessionId !== 'aci17-c' + padded + '-2026' ||
      value.youtubeVideoId !== videoId || value.timingStatus !== 'youtube-caption-aligned' ||
      !Array.isArray(value.chapters) || !value.chapters.length || value.chapters.length > 60) return false

  const chapterIds = new Set<string>()
  const paragraphIds = new Set<string>()
  let paragraphCount = 0
  let priorTime = -1
  for (const entry of value.chapters) {
    if (!isRecord(entry) ||
      typeof entry.id !== 'string' || !new RegExp('^aci17-c' + padded + '-ch\\d\\d$').test(entry.id) ||
      chapterIds.has(entry.id) || !nonempty(entry.title, 300) ||
      !isTime(entry.startSeconds) || !Array.isArray(entry.paragraphs) ||
      !entry.paragraphs.length || entry.paragraphs.length > 160) return false
    chapterIds.add(entry.id)
    if (!isRecord(entry.paragraphs[0]) || entry.paragraphs[0].startSeconds !== entry.startSeconds) return false
    for (const paragraph of entry.paragraphs) {
      if (!isRecord(paragraph) ||
        typeof paragraph.id !== 'string' ||
        !new RegExp('^aci17-c' + padded + '-p\\d{3}$').test(paragraph.id) ||
        paragraphIds.has(paragraph.id) ||
        typeof paragraph.speaker !== 'string' || paragraph.speaker.length > 160 ||
        !nonempty(paragraph.text, 25000) || !isTime(paragraph.startSeconds) ||
        paragraph.startSeconds < priorTime ||
        (paragraph.timingSource !== 'youtube-caption' && paragraph.timingSource !== 'estimated')) return false
      if (paragraph.timingSource === 'youtube-caption' &&
        (!Number.isInteger(paragraph.youtubeCueLine) ||
        (paragraph.youtubeCueLine as number) < 1 ||
        (paragraph.youtubeCueLine as number) > 100000)) return false
      if (paragraph.timingSource === 'estimated' && paragraph.youtubeCueLine != null) return false
      paragraphIds.add(paragraph.id)
      priorTime = paragraph.startSeconds
      if (++paragraphCount > 1600) return false
    }
  }
  return paragraphCount > 0
}

/** Approved-on-upload source. Invalid updates fail closed and cannot replace it. */
export const getACI17Manifest = cache(async (): Promise<ACI17Manifest> =>
  (await readPublishedJSON('classics/course-17/manifest.json', isManifest)) ?? fallback)

const classCodes = new Set(Array.from({ length: 10 }, (_, i) => 'C' + (i + 1)))

/** One authoritative transcript source for class display, search, glossary and exports. */
export const getACI17Transcript = cache(async (
  sessionCode: string,
  youtubeVideoId: string | undefined,
): Promise<ACI17Transcript | null> => {
  if (!classCodes.has(sessionCode) || !youtubeVideoId ||
    !/^[A-Za-z0-9_-]{11}$/.test(youtubeVideoId)) return null
  const padded = String(Number(sessionCode.slice(1))).padStart(2, '0')
  const path = ('classics/course-17/class-' + padded + '/transcript.json') as PublishedJsonPath
  return readPublishedJSON(path, (value): value is ACI17Transcript =>
    isTranscript(value, sessionCode, youtubeVideoId))
})

/** Cached per server request, with a short private-GitHub fetch cache across requests. */
export const getACI17Corpus = cache(async (): Promise<ACI17Corpus> => {
  const manifest = await getACI17Manifest()
  const items = await Promise.all(manifest.offering.sessions.map(async (session, index) => ({
    session,
    index,
    transcript: await getACI17Transcript(session.code, session.videoId),
  })))
  return { manifest, items }
})
