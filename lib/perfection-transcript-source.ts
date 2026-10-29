import 'server-only'

import { readPublishedJSON } from '@/lib/public-content'
import {
  perfectionTranscriptForSession,
  type PerfectionTranscriptChapter,
} from '@/content/perfection-of-wisdom/transcripts'

export type PublishedPerfectionTranscript = {
  schemaVersion: 1
  sessionId: 'pow-g1-s1'
  timingStatus: 'unverified'
  chapters: PerfectionTranscriptChapter[]
}

const PILOT_SESSION_ID = 'pow-g1-s1'

/**
 * Validate all fields before displaying a privately edited transcript.
 * An invalid or unavailable published file cannot replace the known-good
 * local transcript.
 */
export function isPublishedPerfectionTranscript(value: unknown): value is PublishedPerfectionTranscript {
  if (!value || typeof value !== 'object') return false
  const transcript = value as Partial<PublishedPerfectionTranscript>
  if (transcript.schemaVersion !== 1 ||
      transcript.sessionId !== PILOT_SESSION_ID ||
      transcript.timingStatus !== 'unverified' ||
      !Array.isArray(transcript.chapters) ||
      transcript.chapters.length === 0 || transcript.chapters.length > 50) return false

  const chapters = new Set<string>()
  const paragraphs = new Set<string>()
  let count = 0
  for (const entry of transcript.chapters as unknown[]) {
    if (!entry || typeof entry !== 'object') return false
    const chapter = entry as Partial<PerfectionTranscriptChapter>
    if (typeof chapter.id !== 'string' ||
        !/^[a-z0-9][a-z0-9-]*$/.test(chapter.id) ||
        chapters.has(chapter.id) ||
        typeof chapter.title !== 'string' || !chapter.title.trim() ||
        chapter.title.length > 300 ||
        !Array.isArray(chapter.paragraphs) || chapter.paragraphs.length === 0) return false
    chapters.add(chapter.id)

    for (const row of chapter.paragraphs as unknown[]) {
      if (!row || typeof row !== 'object') return false
      const paragraph = row as Partial<{
        id: string; speaker: string; text: string; startSeconds: number | null
      }>
      if (typeof paragraph.id !== 'string' ||
          !/^[a-z0-9][a-z0-9-]*$/.test(paragraph.id) ||
          paragraphs.has(paragraph.id) ||
          typeof paragraph.speaker !== 'string' || paragraph.speaker.length > 160 ||
          typeof paragraph.text !== 'string' || !paragraph.text.trim() ||
          paragraph.text.length > 20000) return false
      if (paragraph.startSeconds !== null &&
          (typeof paragraph.startSeconds !== 'number' ||
           !Number.isFinite(paragraph.startSeconds) ||
           paragraph.startSeconds < 0)) return false
      paragraphs.add(paragraph.id)
      if (++count > 3000) return false
    }
  }
  return true
}

export async function getPerfectionTranscriptChapters(sessionId: string): Promise<PerfectionTranscriptChapter[]> {
  if (sessionId !== PILOT_SESSION_ID) return perfectionTranscriptForSession(sessionId)

  const published = await readPublishedJSON(
    'perfection-of-wisdom/introduction-q-a-2021/first-qa-winter-2021/transcript.json',
    isPublishedPerfectionTranscript,
  )
  return published?.chapters ?? perfectionTranscriptForSession(sessionId)
}
