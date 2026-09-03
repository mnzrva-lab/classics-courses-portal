import Link from 'next/link'
import rawCatalog from '@/content/living-lam-rim/catalog.json'

type Session = {
  id: string
  transcriptSource: string | null
}

type Term = {
  term: number
  slug: string
  title: string | null
  range: string
  note: string | null
  sessions: Session[]
}

type Catalog = {
  program: {
    title: string
    playlistUrl: string
  }
  terms: Term[]
}

const catalog = rawCatalog as Catalog

export default function LivingLamRimPage() {
  const totalSessions = catalog.terms.reduce((sum, term) => sum + term.sessions.length, 0)
  const transcriptCount = catalog.terms.reduce((sum, term) => sum + term.sessions.filter((session) => Boolean(session.transcriptSource)).length, 0)

  return (
    <main className="container page living-lam-rim-page">
      <section className="offering-hero no-artwork">
        <div className="offering-hero-copy">
          <div className="eyebrow">Long-running teaching archive</div>
          <h1 className="offering-title">{catalog.program.title}</h1>
          <p className="lead">Study the archive term by term, with each recording kept as its own class page.</p>
          <div className="offering-meta">
            <span className="pill">{catalog.terms.length} terms</span>
            <span className="pill">{totalSessions} recordings</span>
            <span className="pill">{transcriptCount} transcript migrated</span>
          </div>
          <div className="actions" style={{ marginTop: 20 }}>
            <a className="button" href={catalog.program.playlistUrl} target="_blank" rel="noreferrer">Open full YouTube playlist ↗</a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Archive</div>
            <h2>Terms</h2>
            <p>Open a term to see its classes and recordings.</p>
          </div>
        </div>

        <div className="home-explore-grid">
          {catalog.terms.map((term) => (
            <Link className="card home-library-card" href={`/living-lam-rim/${term.slug}`} key={term.slug}>
              <div className="eyebrow">Term {term.term}</div>
              <h3>{term.title ?? `Term ${term.term}`}</h3>
              <p className="meta">{term.range} · {term.sessions.length} recordings</p>
              {term.note ? <p className="meta">{term.note}</p> : null}
              <div className="go">Open term →</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
