/**
 * Published Library v1: intentionally small content contract.
 * No accounts, per-class deployments, or user-editable filesystem paths.
 * Use these validators before any private GitHub data reaches public pages.
 */
export type ManagedLibraryEntry = {
  programSlug: string
  offeringSlug: string
  source: 'managed-v1' | 'existing-aci17' | 'standalone-v1'
}
export type ManagedLibraryIndex = {
  schemaVersion: 1
  entries: ManagedLibraryEntry[]
}
export type PublishedMaterialLink = { label: string; url: string }
export type ManagedLibrarySession = {
  slug: string
  code: string
  title: string
  date?: string
  teacher?: string
  duration?: string
  recordingUrl?: string | null
  transcript?: boolean
  studyNotes?: boolean
  materials?: PublishedMaterialLink[]
}
export type ManagedLibraryManifest = {
  schemaVersion: 1
  programSlug: string
  offeringSlug: string
  programTitle: string
  offeringLabel: string
  kind: string
  description?: string
  artwork?: string
  artworkAlt?: string
  playlistUrl?: string
  sessions: ManagedLibrarySession[]
}
export type ManagedTranscriptParagraph = {
  id: string
  speaker: string
  text: string
  startSeconds: number | null
  timingSource?: 'youtube-caption' | 'estimated'
  youtubeCueLine?: number
}
export type ManagedTranscriptChapter = {
  id: string
  title: string
  startSeconds: number | null
  paragraphs: ManagedTranscriptParagraph[]
}
export type ManagedTranscript = {
  schemaVersion: 1
  sessionId: string
  youtubeVideoId?: string | null
  timingStatus: 'unverified' | 'youtube-caption-aligned'
  chapters: ManagedTranscriptChapter[]
}

const wordSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function nonempty(value: unknown, limit: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= limit
}
export function isPublishedSlug(value: unknown): value is string {
  return nonempty(value, 80) && wordSlug.test(value)
}
export function isApprovedExternalLink(value: unknown): value is string {
  if (!nonempty(value, 2048)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch { return false }
}
export function isManagedLibraryIndex(value: unknown): value is ManagedLibraryIndex {
  if (!isRecord(value) || value.schemaVersion !== 1 ||
      !Array.isArray(value.entries) || !value.entries.length || value.entries.length > 40) return false
  const seen = new Set<string>()
  for (const entry of value.entries) {
    if (!isRecord(entry) || !isPublishedSlug(entry.programSlug) ||
        !isPublishedSlug(entry.offeringSlug) ||
        (entry.source !== 'existing-aci17' && entry.source !== 'managed-v1' && entry.source !== 'standalone-v1')) return false
    const id = entry.programSlug + '/' + entry.offeringSlug
    if (seen.has(id)) return false
    seen.add(id)
    if (entry.source === 'existing-aci17' && id !== 'classics-course-17/arizona-2026') return false
    if (entry.source === 'standalone-v1' && entry.programSlug !== 'other-programs') return false
    if (entry.source === 'managed-v1' && !/^classics-course-(?:[1-9]|1[0-8])$/.test(entry.programSlug)) return false
  }
  return true
}
export function isManagedLibraryManifest(
  value: unknown, programSlug: string, offeringSlug: string,
): value is ManagedLibraryManifest {
  if (!isPublishedSlug(programSlug) || !isPublishedSlug(offeringSlug) ||
      !isRecord(value) || value.schemaVersion !== 1 ||
      value.programSlug !== programSlug || value.offeringSlug !== offeringSlug ||
      !nonempty(value.programTitle, 250) || !nonempty(value.offeringLabel, 200) ||
      !nonempty(value.kind, 90) ||
      (value.description !== undefined && !nonempty(value.description, 6000)) ||
      (value.artwork !== undefined && (!nonempty(value.artwork, 300) ||
        !/^\/images\/[a-zA-Z0-9/_-]+\.(webp|png|jpg|jpeg)$/.test(value.artwork))) ||
      (value.artworkAlt !== undefined && !nonempty(value.artworkAlt, 300)) ||
      (value.playlistUrl !== undefined && !isApprovedExternalLink(value.playlistUrl)) ||
      !Array.isArray(value.sessions) || !value.sessions.length || value.sessions.length > 40) return false
  const seen = new Set<string>()
  for (const session of value.sessions) {
    if (!isRecord(session) || !isPublishedSlug(session.slug) ||
        seen.has(session.slug) || !nonempty(session.code, 25) ||
        !nonempty(session.title, 250) ||
        (session.date !== undefined && !nonempty(session.date, 80)) ||
        (session.teacher !== undefined && !nonempty(session.teacher, 200)) ||
        (session.duration !== undefined && !nonempty(session.duration, 80)) ||
        (session.recordingUrl != null && !isApprovedExternalLink(session.recordingUrl)) ||
        (session.transcript !== undefined && typeof session.transcript !== 'boolean') ||
        (session.studyNotes !== undefined && typeof session.studyNotes !== 'boolean') ||
        (session.materials !== undefined && (!Array.isArray(session.materials) ||
          session.materials.length > 20 || !session.materials.every(
            (m: unknown) => isRecord(m) && nonempty(m.label, 200) && isApprovedExternalLink(m.url)
          )))) return false
    seen.add(session.slug)
  }
  return true
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) &&
    value >= 0 && value <= 21600
}
export function isManagedTranscript(value: unknown, session: ManagedLibrarySession): value is ManagedTranscript {
  if (!isRecord(value) || value.schemaVersion !== 1 ||
      value.sessionId !== session.slug ||
      (value.timingStatus !== 'unverified' && value.timingStatus !== 'youtube-caption-aligned') ||
      !Array.isArray(value.chapters) || !value.chapters.length || value.chapters.length > 100) return false
  const chapterIds = new Set<string>()
  const paragraphIds = new Set<string>()
  let count = 0
  let previous = -1
  for (const chapter of value.chapters) {
    if (!isRecord(chapter) || !isPublishedSlug(chapter.id) || chapterIds.has(chapter.id) ||
        !nonempty(chapter.title, 300) ||
        !Array.isArray(chapter.paragraphs) || !chapter.paragraphs.length ||
        chapter.paragraphs.length > 200 ||
        !(chapter.startSeconds === null || isTime(chapter.startSeconds))) return false
    chapterIds.add(chapter.id)
    if (!isRecord(chapter.paragraphs[0]) ||
        chapter.startSeconds !== chapter.paragraphs[0].startSeconds) return false
    for (const paragraph of chapter.paragraphs) {
      if (!isRecord(paragraph) || !isPublishedSlug(paragraph.id) ||
          paragraphIds.has(paragraph.id) ||
          typeof paragraph.speaker !== 'string' || paragraph.speaker.length > 160 ||
          !nonempty(paragraph.text, 25000) ||
          !(paragraph.startSeconds === null || isTime(paragraph.startSeconds))) return false
      paragraphIds.add(paragraph.id)
      if (value.timingStatus === 'unverified') {
        if (paragraph.startSeconds !== null || paragraph.timingSource !== undefined) return false
      } else {
        if (!isTime(paragraph.startSeconds) || paragraph.startSeconds < previous ||
            (paragraph.timingSource !== 'youtube-caption' &&
             paragraph.timingSource !== 'estimated')) return false
        if (paragraph.timingSource === 'youtube-caption' &&
            (!Number.isInteger(paragraph.youtubeCueLine) ||
             (paragraph.youtubeCueLine as number) < 1)) return false
        if (paragraph.timingSource === 'estimated' &&
            paragraph.youtubeCueLine != null) return false
        previous = paragraph.startSeconds
      }
      if (++count > 4000) return false
    }
  }
  const videoId = value.youtubeVideoId
  if (videoId != null && (typeof videoId !== 'string' ||
      !/^[A-Za-z0-9_-]{11}$/.test(videoId))) return false
  if (value.timingStatus === 'youtube-caption-aligned') {
    if (!videoId || !session.recordingUrl ||
        !session.recordingUrl.includes(videoId)) return false
  }
  return count > 0
}


/** One-off teachings have no fake term/class folder. All files share one root. */
export type StandaloneTeachingManifest = {
  schemaVersion: 1
  teachingSlug: string
  title: string
  subtitle?: string
  teacher?: string
  date?: string
  description?: string
  recordingUrl?: string | null
  transcript?: boolean
  studyNotes?: boolean
  artwork?: string
  artworkAlt?: string
  materials?: PublishedMaterialLink[]
}

export function isStandaloneTeachingManifest(value: unknown, slug: string): value is StandaloneTeachingManifest {
  if (!isPublishedSlug(slug) || !isRecord(value) ||
      value.schemaVersion !== 1 || value.teachingSlug !== slug ||
      !nonempty(value.title, 250) ||
      (value.subtitle !== undefined && !nonempty(value.subtitle, 300)) ||
      (value.teacher !== undefined && !nonempty(value.teacher, 200)) ||
      (value.date !== undefined && !nonempty(value.date, 80)) ||
      (value.description !== undefined && !nonempty(value.description, 6000)) ||
      (value.recordingUrl != null && !isApprovedExternalLink(value.recordingUrl)) ||
      (value.transcript !== undefined && typeof value.transcript !== 'boolean') ||
      (value.studyNotes !== undefined && typeof value.studyNotes !== 'boolean') ||
      (value.artwork !== undefined && (!nonempty(value.artwork, 300) ||
        !/^\/images\/[a-zA-Z0-9/_-]+\.(webp|png|jpg|jpeg)$/.test(value.artwork))) ||
      (value.artworkAlt !== undefined && !nonempty(value.artworkAlt, 300)) ||
      (value.materials !== undefined &&
        (!Array.isArray(value.materials) || value.materials.length > 20 ||
          !value.materials.every((item: unknown) =>
            isRecord(item) && nonempty(item.label, 200) && isApprovedExternalLink(item.url))))) {
    return false
  }
  return true
}
