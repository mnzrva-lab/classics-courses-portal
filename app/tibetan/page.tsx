export const revalidate = 60

import TibetanTermBrowser from '@/components/tibetan-term-browser'
import { transcriptTermSlug } from '@/content/tibetan/transcript-glossary'
import { getPublishedGlossaryTerms } from '@/lib/published-tibetan-glossary'

export default async function TibetanPage() {
  const terms = (await getPublishedGlossaryTerms()).map((item) => ({
    term: item.term,
    slug: transcriptTermSlug(item.term),
    context: item.context,
    source: item.source,
    occurrenceCount: item.occurrences.length,
  }))

  return (
    <main className="container page">
      <div className="eyebrow">Tibetan</div>
      <h1>Tibetan glossary</h1>
      <p className="lead">Explore Tibetan terms marked in the teaching transcripts, with links to each source passage.</p>
      <p className="meta">Terms are automatically indexed from the original bracketed transliterations. Headings omit square brackets, while excerpts and citations preserve the source text. Definitions are not presented as verified translations.</p>
      <TibetanTermBrowser terms={terms} />
    </main>
  )
}
