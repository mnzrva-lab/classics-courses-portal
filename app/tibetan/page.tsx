import Link from 'next/link'
import { transcriptGlossaryTerms } from '@/content/tibetan/transcript-glossary'

function passageWithHighlight(href: string, term: string) {
  const [base, anchor] = href.split('#')
  return base + '?highlight=' + encodeURIComponent(term) + (anchor ? '#' + anchor : '')
}
const PAGE_SIZE = 24

export default async function TibetanPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams
  const terms = transcriptGlossaryTerms()
  const totalPages = Math.max(1, Math.ceil(terms.length / PAGE_SIZE))
  const requested = Number(params.page || 1)
  const page = Number.isFinite(requested) ? Math.min(totalPages, Math.max(1, Math.floor(requested))) : 1
  const visible = terms.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <main className="container page">
      <div className="eyebrow">Tibetan</div>
      <h1>Tibetan glossary</h1>
      <p className="lead">Terms currently marked in square brackets in the migrated transcripts, with a short excerpt from the class where each term appears.</p>
      <p className="meta">Only explicitly marked Tibetan or uppercase Wylie terms are collected automatically. Meanings are not guessed or presented as verified definitions. Open a term to explore its source passages.</p>

      <section className="section">
        {visible.length ? (
          <div className="tibetan-term-grid">
            {visible.map((item) => (
              <article className="tibetan-term-card" key={item.term.toLocaleLowerCase()}>
                <h2><strong>{item.term}</strong></h2>
                <p className="tibetan-term-context">{item.context}</p>
                <div className="tibetan-term-source">{item.source}</div>
                <div className="tibetan-term-count">{item.occurrences.length} source passage{item.occurrences.length === 1 ? '' : 's'}</div>
                <Link href={`/tibetan/source/${encodeURIComponent(item.term)}`}>View term hub and citations →</Link>
                {item.occurrences.length === 1 ? (
                  <Link href={passageWithHighlight(item.href, item.term)}>Open passage →</Link>
                ) : (
                  <details className="tibetan-mentions">
                    <summary>Browse all {item.occurrences.length} mentions</summary>
                    {item.occurrences.map((mention) => (
                      <div className="tibetan-mention" key={mention.href}>
                        <strong>{mention.source}</strong>
                        <p>{mention.context}</p>
                        <Link href={passageWithHighlight(mention.href, item.term)}>Open exact passage →</Link>
                      </div>
                    ))}
                  </details>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="card"><p className="meta">No bracketed glossary terms were found in the currently migrated transcripts.</p></div>
        )}

        {totalPages > 1 ? (
          <nav className="glossary-pagination" aria-label="Glossary pages">
            {page > 1 ? <Link className="button" href={`/tibetan?page=${page - 1}`}>← Previous</Link> : null}
            <span className="glossary-page-number">Page {page} of {totalPages}</span>
            {page < totalPages ? <Link className="button" href={`/tibetan?page=${page + 1}`}>Next →</Link> : null}
          </nav>
        ) : null}
      </section>
    </main>
  )
}
