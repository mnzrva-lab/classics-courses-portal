import 'server-only'
import { cache } from 'react'
import { getACI17Manifest, getACI17Transcript } from '@/lib/aci17-published-content'
import { archiveSessionSlug } from '@/content/classics/archive-route'
import { readManagedJSON, readManagedMarkdown } from '@/lib/public-content'
import { managedCoverUrl } from '@/lib/published-cover'
import {
  isManagedLibraryIndex,
  isManagedLibraryManifest,
  isManagedTranscript,
  type ManagedLibraryIndex,
  type ManagedLibraryEntry,
  type ManagedLibrarySession,
  type ManagedLibraryManifest,
  type ManagedTranscript,
} from '@/lib/managed-library-schema'

export type PublishedLibraryClass = ManagedLibrarySession & { href: string }
export type PublishedLibraryOffering = Omit<ManagedLibraryManifest, 'sessions'> & {
  source: ManagedLibraryEntry['source']
  href: string
  sessions: PublishedLibraryClass[]
}
export type PublishedLibraryClassContent = {
  offering: PublishedLibraryOffering
  session: PublishedLibraryClass
  transcript: ManagedTranscript | null
  studyNotes: string | null
}

function offeringUrl(programSlug: string, offeringSlug: string): string | null {
  const match = /^classics-course-([1-9]|1[0-8])$/.exec(programSlug)
  // A content source is not a student-facing section. New collections need
  // explicit integration into an existing program's URL hierarchy.
  return match ? '/courses/course-' + match[1] + '/' + offeringSlug : null
}

/** The private catalog is the only authority for new program routes. */
export const getManagedLibraryIndex = cache(async (): Promise<ManagedLibraryIndex | null> =>
  readManagedJSON('library/index.json', isManagedLibraryIndex))

export const getPublishedLibraryOffering = cache(async (
  programSlug: string, offeringSlug: string,
): Promise<PublishedLibraryOffering | null> => {
  const index = await getManagedLibraryIndex()
  const entry = index?.entries.find(e => e.programSlug === programSlug && e.offeringSlug === offeringSlug)
  if (!entry) return null
  if (entry.source === 'existing-aci17') {
    // Existing ACI 17 is a live reference without duplicating 817 paragraphs.
    // All its old, externally shared course and class URLs remain canonical.
    const manifest = await getACI17Manifest()
    return {
      schemaVersion: 1,
      programSlug,
      offeringSlug,
      programTitle: manifest.title,
      offeringLabel: manifest.offering.label,
      kind: 'Classics Course 17',
      artwork: manifest.artwork,
      artworkAlt: manifest.artworkAlt,
      playlistUrl: manifest.offering.playlistUrl,
      source: entry.source,
      href: '/courses/course-17/current-2026',
      sessions: manifest.offering.sessions.map((session, index) => ({
        slug: 'class-' + (index + 1),
        code: session.code,
        title: session.name,
        date: session.date,
        teacher: session.teacher,
        duration: session.duration,
        recordingUrl: session.url,
        transcript: true,
        href: '/archive/classics/course-17/current-2026/' + archiveSessionSlug(session, index),
      })),
    }
  }

  // No paths are taken from URL parameters or arbitrary catalog fields.
  const prefix = 'library/' + programSlug + '/' + offeringSlug + '/'
  const manifest = await readManagedJSON(
    prefix + 'manifest.json',
    (value): value is ManagedLibraryManifest => isManagedLibraryManifest(value, programSlug, offeringSlug),
  )
  if (!manifest) return null
  const base = offeringUrl(programSlug, offeringSlug)
  if (!base) return null
  const publicCourseSlug = 'course-' + programSlug.slice('classics-course-'.length)
  // The private WebP in the offering folder wins; then a shared course cover;
  // then an existing explicitly published /images path; otherwise no image.
  const discoveredCover = await managedCoverUrl(programSlug, offeringSlug, true)
  return {
    ...manifest,
    artwork: discoveredCover ?? manifest.artwork,
    source: 'managed-v1',
    href: base,
    sessions: manifest.sessions.map(session => ({
      ...session,
      href: '/archive/classics/' + publicCourseSlug + '/' + offeringSlug + '/' + session.slug,
    })),
  }
})

export const getPublishedLibraryOfferings = cache(async (): Promise<PublishedLibraryOffering[]> => {
  const index = await getManagedLibraryIndex()
  if (!index) return []
  const offerings = await Promise.all(index.entries.map(entry =>
    getPublishedLibraryOffering(entry.programSlug, entry.offeringSlug)
  ))
  return offerings.filter((value): value is PublishedLibraryOffering => value !== null)
})

/** Same validated source serves the class reader and TXT/DOCX downloads. */
export const getPublishedLibraryClass = cache(async (
  programSlug: string,
  offeringSlug: string,
  sessionSlug: string,
): Promise<PublishedLibraryClassContent | null> => {
  const offering = await getPublishedLibraryOffering(programSlug, offeringSlug)
  const session = offering?.sessions.find(s => s.slug === sessionSlug)
  if (!offering || !session) return null

  if (offering.source === 'existing-aci17') {
    const manifest = await getACI17Manifest()
    const original = manifest.offering.sessions.find(s => s.code === session.code)
    if (!original) return null
    return {
      offering,
      session,
      transcript: await getACI17Transcript(original.code, original.videoId),
      studyNotes: null,
    }
  }

  const base = 'library/' + programSlug + '/' + offeringSlug + '/' + session.slug + '/'
  const [transcript, studyNotes] = await Promise.all([
    session.transcript
      ? readManagedJSON(base + 'transcript.json',
          (value): value is ManagedTranscript => isManagedTranscript(value, session))
      : Promise.resolve(null),
    session.studyNotes ? readManagedMarkdown(base + 'study-notes.md') : Promise.resolve(null),
  ])
  return { offering, session, transcript, studyNotes }
})
