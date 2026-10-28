import 'server-only'
import { cache } from 'react'
import { archiveSessionSlug } from '@/content/classics/archive-route'
import {
  transcriptGlossaryTerms,
  type SourceEntry,
} from '@/content/tibetan/transcript-glossary'
import { getACI17Corpus } from '@/lib/aci17-published-content'
import { getPublishedSearchRecords } from '@/lib/published-search-index'

/**
 * Include source-marked Tibetan terms from the same published class JSON that
 * the course reader, downloads and full-text search use. No separate index
 * needs manual edits or website redeployments after a transcript correction.
 */
export const getPublishedGlossaryTerms = cache(async () => {
  const [corpus, published] = await Promise.all([getACI17Corpus(), getPublishedSearchRecords()])
  const additions: SourceEntry[] = corpus.items.flatMap(({ session, transcript, index }) =>
    transcript ? [{
      label: 'Classics Course 17 · ' + session.code + ' · ' + corpus.manifest.offering.label,
      hrefBase: '/archive/classics/course-17/current-2026/' + archiveSessionSlug(session, index),
      chapters: transcript.chapters,
    }] : [],
  )
  // The same generated paragraph index powers Search and Tibetan discovery.
  // Scan only verbatim source-marked transcript text, retaining exact anchors.
  const bySource = new Map<string, SourceEntry>()
  for (const item of published) {
    if (item.contentType !== 'Transcript' || !item.glossarySource) continue
    const paragraphId = item.href.split('#')[1]
    if (!paragraphId) continue
    let entry = bySource.get(item.glossarySource)
    if (!entry) {
      entry = {
        label: item.sourceLabel + ' · ' + item.sessionLabel,
        hrefBase: item.glossarySource,
        chapters: [{ paragraphs: [] }],
      }
      bySource.set(item.glossarySource, entry)
    }
    entry.chapters[0].paragraphs.push({ id: paragraphId, text: item.body })
  }
  return transcriptGlossaryTerms([...additions, ...bySource.values()])
})
