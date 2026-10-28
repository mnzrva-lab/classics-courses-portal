import 'server-only'

/**
 * Temporary ACI 17 preview reader. Content is stored on a separate, private
 * GitHub preview branch and is not eligible for production publication.
 * No student data and no browser-visible GitHub credential are involved.
 */
export type ACI17Paragraph = {
  id: string
  speaker: string
  text: string
  startSeconds: number | null
}

export type ACI17Chapter = {
  id: string
  title: string
  startSeconds: number | null
  paragraphs: ACI17Paragraph[]
}

export type ACI17PreviewTranscript = {
  schemaVersion: 1
  sessionId: string
  youtubeVideoId: string
  timingStatus: 'unverified'
  chapters: ACI17Chapter[]
}

const REPO = 'mnzrva-lab/classics-library-content'
const SOURCE_REF = 'aci17-preview-2026'
const SOURCE_PATH = 'staging/classics/course-17'
const classCodes = new Set(Array.from({ length: 10 }, (_, i) => `C${i + 1}`))

function isTime(value: unknown): value is number | null {
  return value === null ||
    (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 21600)
}

function isTranscript(value: unknown, sessionId: string, videoId: string): value is ACI17PreviewTranscript {
  if (!value || typeof value !== 'object') return false
  const doc = value as Record<string, unknown>
  if (doc.schemaVersion !== 1 || doc.sessionId !== sessionId ||
      doc.youtubeVideoId !== videoId || doc.timingStatus !== 'unverified' ||
      !Array.isArray(doc.chapters) || doc.chapters.length === 0 || doc.chapters.length > 60) return false

  const chapterIds = new Set<string>()
  const paragraphIds = new Set<string>()
  let paragraphCount = 0
  let priorTime = -1
  for (const entry of doc.chapters as unknown[]) {
    if (!entry || typeof entry !== 'object') return false
    const chapter = entry as Record<string, unknown>
    if (typeof chapter.id !== 'string' || !/^aci17-c\d\d-ch\d\d$/.test(chapter.id) ||
        chapterIds.has(chapter.id) || typeof chapter.title !== 'string' ||
        !chapter.title.trim() || chapter.title.length > 300 ||
        !isTime(chapter.startSeconds) || !Array.isArray(chapter.paragraphs) ||
        chapter.paragraphs.length === 0 || chapter.paragraphs.length > 160) return false
    chapterIds.add(chapter.id)

    if ((chapter.paragraphs[0] as Record<string, unknown> | undefined)?.startSeconds !== chapter.startSeconds) return false
    for (const row of chapter.paragraphs as unknown[]) {
      if (!row || typeof row !== 'object') return false
      const paragraph = row as Record<string, unknown>
      if (typeof paragraph.id !== 'string' || !/^aci17-c\d\d-p\d{3}$/.test(paragraph.id) ||
          paragraphIds.has(paragraph.id) || typeof paragraph.speaker !== 'string' ||
          paragraph.speaker.length > 160 || typeof paragraph.text !== 'string' ||
          !paragraph.text.trim() || paragraph.text.length > 25000 ||
          !isTime(paragraph.startSeconds)) return false
      if (typeof paragraph.startSeconds === 'number') {
        if (paragraph.startSeconds < priorTime) return false
        priorTime = paragraph.startSeconds
      }
      paragraphIds.add(paragraph.id)
      if (++paragraphCount > 1600) return false
    }
  }
  return paragraphCount > 0
}

/**
 * Reads only the current ACI 17 source branch from a server-side, read-only token.
 * Unknown classes and video versions are deliberately rejected.
 */
export async function getACI17PreviewTranscript(sessionCode: string, videoId: string | undefined): Promise<ACI17PreviewTranscript | null> {
  if (!classCodes.has(sessionCode) || !videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
  const token = process.env.LIBRARY_CONTENT_GITHUB_TOKEN?.trim()
  if (!token) return null

  const n = Number(sessionCode.slice(1))
  const padded = String(n).padStart(2, '0')
  const sessionId = `aci17-c${padded}-2026`
  const filePath = `${SOURCE_PATH}/class-${padded}/transcript.json`
  const url = `https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${SOURCE_REF}`

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'classics-courses-portal',
      },
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return null
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') return null
    const file = payload as { type?: unknown; encoding?: unknown; content?: unknown }
    if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string') return null
    const buffer = Buffer.from(file.content.replace(/\s/g, ''), 'base64')
    if (buffer.byteLength < 200 || buffer.byteLength > 100000) return null
    const parsed: unknown = JSON.parse(buffer.toString('utf8'))
    return isTranscript(parsed, sessionId, videoId) ? parsed : null
  } catch {
    return null
  }
}