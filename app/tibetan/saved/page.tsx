import Link from 'next/link'
import TibetanTermBrowser from '@/components/tibetan-term-browser'
import { transcriptGlossaryTerms, transcriptTermSlug } from '@/content/tibetan/transcript-glossary'

export default function SavedTibetanTermsPage() {
  const terms = transcriptGlossaryTerms().map((item) => ({
    term: item.term,
    slug: transcriptTermSlug(item.term),
    context: item.context,
    source: item.source,
    occurrenceCount: item.occurrences.length,
  }))

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/tibetan">Tibetan glossary</Link><span>/</span><span>Saved terms</span>
      </div>
      <div className="eyebrow">Your study list</div>
      <h1>My saved Tibetan terms</h1>
      <p className="lead">Return to the terms you starred while reading and studying.</p>
      <TibetanTermBrowser terms={terms} savedOnly />
    </main>
  )
}
