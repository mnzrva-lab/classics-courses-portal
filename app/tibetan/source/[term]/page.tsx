import Link from 'next/link'
import { notFound } from 'next/navigation'
import CopyReference from '@/components/copy-reference'
import TibetanHubStar from '@/components/tibetan-hub-star'
import { transcriptGlossaryTerms, transcriptTermSlug } from '@/content/tibetan/transcript-glossary'

function passageWithHighlight(href: string, term: string) {
  const [base, anchor] = href.split('#')
  return base + '?highlight=' + encodeURIComponent(term) + (anchor ? '#' + anchor : '')
}

export default async function TranscriptTermHub({ params }: {
  params: Promise<{ term: string }>
}) {
  const { term: requested } = await params
  // Next.js and hosting providers may supply encoded or already decoded route parameters.
  // Keep legacy term URLs working while new links use URL-safe stable slugs.
  let decoded = requested
  try { decoded = decodeURIComponent(requested) } catch { /* Keep the raw URL parameter. */ }
  const requestedSlug = transcriptTermSlug(decoded)
  const entry = transcriptGlossaryTerms().find((item) =>
    item.term === decoded || transcriptTermSlug(item.term) === requested || transcriptTermSlug(item.term) === requestedSlug
  )
  if (!entry) notFound()

  return (
    <main className="container page">
      <div className="offering-breadcrumbs"><Link href="/tibetan">Tibetan glossary</Link><span>/</span><span>Source term</span></div>
      <section className="section">
        <div className="eyebrow">Transcript-derived Tibetan term</div>
        <h1>{entry.term}</h1>
        <TibetanHubStar term={entry.term} slug={transcriptTermSlug(entry.term)} />
        <p className="lead">{entry.occurrences.length} teaching passage{entry.occurrences.length === 1 ? '' : 's'} mentioning this term</p>
        <p className="meta">This term was collected automatically from marked passages in the teaching transcripts. The original spelling and passages are preserved. This page does not claim a verified translation or dictionary definition.</p>
      </section>
      <section className="section">
        <div className="section-head"><h2>Where this term appears</h2></div>
        {entry.occurrences.map((mention) => (
          <article className="search-result-row" key={mention.href}>
            <strong className="search-result-source">{mention.source}</strong>
            <p className="search-result-copy">{mention.context}</p>
            <div className="actions">
              <Link className="button" href={passageWithHighlight(mention.href, entry.term)}>Open exact passage</Link>
              <CopyReference reference={'Tibetan term: ' + mention.markedTerm + ' · ' + mention.source + ' · Reference Transcript'} path={mention.href} />
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
