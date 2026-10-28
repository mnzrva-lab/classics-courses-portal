import 'server-only'
import { cache } from 'react'
import { getManagedLibraryIndex } from '@/lib/managed-library-content'
import { readManagedJSON, readManagedMarkdown } from '@/lib/public-content'
import { managedCoverUrl } from '@/lib/published-cover'
import {
  isManagedTranscript, isStandaloneTeachingManifest, isPublishedSlug,
  type ManagedTranscript, type StandaloneTeachingManifest,
} from '@/lib/managed-library-schema'

export type StandaloneTeaching = StandaloneTeachingManifest & {
  href: string
  cover: string | null
}
export type StandaloneTeachingContent = {
  teaching: StandaloneTeaching
  transcript: ManagedTranscript | null
  studyNotes: string | null
}

export const getStandaloneTeaching = cache(async (teachingSlug: string): Promise<StandaloneTeaching | null> => {
  if (!isPublishedSlug(teachingSlug) || teachingSlug === 'eye-of-courage') return null
  const index = await getManagedLibraryIndex()
  if (!index?.entries.some(item => item.programSlug === 'other-programs' &&
      item.offeringSlug === teachingSlug && item.source === 'standalone-v1')) return null
  const base = 'library/other-programs/' + teachingSlug + '/'
  const manifest = await readManagedJSON(base + 'manifest.json',
    (value): value is StandaloneTeachingManifest => isStandaloneTeachingManifest(value, teachingSlug))
  if (!manifest) return null
  const cover = await managedCoverUrl('other-programs', teachingSlug, false)
  return {
    ...manifest,
    cover: cover ?? manifest.artwork ?? null,
    href: '/other-programs/' + teachingSlug,
  }
})

export const getStandaloneTeachings = cache(async (): Promise<StandaloneTeaching[]> => {
  const index = await getManagedLibraryIndex()
  const refs = index?.entries.filter(item =>
    item.programSlug === 'other-programs' && item.source === 'standalone-v1') ?? []
  const items = await Promise.all(refs.map(entry => getStandaloneTeaching(entry.offeringSlug)))
  return items.filter((item): item is StandaloneTeaching => item !== null)
})

/** A standalone teaching has transcript and notes in its own folder. No fake class. */
export const getStandaloneTeachingContent = cache(async (teachingSlug: string):
  Promise<StandaloneTeachingContent | null> => {
  const teaching = await getStandaloneTeaching(teachingSlug)
  if (!teaching) return null
  const base = 'library/other-programs/' + teachingSlug + '/'
  const [transcript, studyNotes] = await Promise.all([
    teaching.transcript
      ? readManagedJSON(base + 'transcript.json', (value): value is ManagedTranscript =>
          isManagedTranscript(value, { slug: teachingSlug, code: 'T', title: teaching.title,
            recordingUrl: teaching.recordingUrl }))
      : Promise.resolve(null),
    teaching.studyNotes
      ? readManagedMarkdown(base + 'study-notes.md')
      : Promise.resolve(null),
  ])
  return { teaching, transcript, studyNotes }
})
