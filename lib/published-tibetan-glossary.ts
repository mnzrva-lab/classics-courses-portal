import 'server-only'
import { cache } from 'react'
import { archiveSessionSlug } from '@/content/classics/archive-route'
import {
  transcriptGlossaryTerms,
  type SourceEntry,
} from '@/content/tibetan/transcript-glossary'
import { getACI17Corpus } from '@/lib/aci17-published-content'

/**
 * Include source-marked Tibetan terms from the same published class JSON that
 * the course reader, downloads and full-text search use. No separate index
 * needs manual edits or website redeployments after a transcript correction.
 */
export const getPublishedGlossaryTerms = cache(async () => {
  const corpus = await getACI17Corpus()
  const additions: SourceEntry[] = corpus.items.flatMap(({ session, transcript, index }) =>
    transcript ? [{
      label: 'Classics Course 17 · ' + session.code + ' · ' + corpus.manifest.offering.label,
      hrefBase: '/archive/classics/course-17/current-2026/' + archiveSessionSlug(session, index),
      chapters: transcript.chapters,
    }] : [],
  )
  return transcriptGlossaryTerms(additions)
})
