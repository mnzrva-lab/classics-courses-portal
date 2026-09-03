import Link from 'next/link'
import rawCatalog from '@/content/living-lam-rim/catalog.json'

type Session = { id: string; transcriptSource: string | null }
type Term = {
  term: number
  slug: string
  title: string | null
  range: string
  note: string | null
  sessions: Session[]
}
type Catalog = { program: { title: string; playlistUrl: string }; terms: Term[] }

const catalog = rawCatalog as Catalog

export default function LivingLamRimPage() {
  return (
    <main className="container page living-lam-rim-page">
      <header className="compact-page-head">
        <div className="eyebrow">Living Lam Rim</div>
        <h1>{catalog.program.title}</h1>
        <p className="lead">Choose a term, then open the class you want to study.</p>
        <a className="inline-library-link" href={catalog.program.playlistUrl} target="_blank" rel="noreferrer">Open playlist on YouTube ↗</a>
      </header>

      <section className="section compact-section">
        <div className="section-head"><div><div className="eyebrow">Terms</div><h2>Choose a term</h2></div></div>
        <div className="term-button-list">
          {catalog.terms.map((term) => (
            <Link className="term-button" href={`/living-lam-rim/${term.slug}`} key={term.slug}>
              <strong>Term {term.term}</strong>
              <span>{term.title ?? term.range}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
