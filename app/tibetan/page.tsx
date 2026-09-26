import Link from 'next/link'
import { transcriptGlossaryTerms } from '@/content/tibetan/transcript-glossary'

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
      <p className="meta">This is a transcript-derived study index for now, not yet a reviewed dictionary. Open any card to return to the exact source passage.</p>

      <section className="section">
        {visible.length ? (
          <div className="tibetan-term-grid">
            {visible.map((item) => (
              <Link className="tibetan-term-card" href={item.href} key={item.term.toLocaleLowerCase()}>
                <h2><strong>{item.term}</strong></h2>
                <p className="tibetan-term-context">{item.context}</p>
                <div className="tibetan-term-source">{item.source} →</div>
              </Link>
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
