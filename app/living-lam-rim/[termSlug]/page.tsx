import Link from 'next/link'
import { notFound } from 'next/navigation'
import rawCatalog from '@/content/living-lam-rim/catalog.json'

type Session = {
  id: string
  slug: string
  code: string
  label: string
  kind: string
  date: string
  duration: string
  recordingUrl: string
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
type Catalog = { terms: Term[] }

const catalog = rawCatalog as Catalog

export default async function LivingLamRimTermPage({ params }: { params: Promise<{ termSlug: string }> }) {
  const { termSlug } = await params
  const term = catalog.terms.find((item) => item.slug === termSlug)
  if (!term) notFound()

  return (
    <main className="container page living-lam-rim-term-page">
      <div className="offering-breadcrumbs"><Link href="/living-lam-rim">Living Lam Rim</Link><span>/</span><span>Term {term.term}</span></div>

      <header className="compact-page-head">
        <div className="eyebrow">Term {term.term}</div>
        <h1>{term.title ?? `Term ${term.term}`}</h1>
        <p className="lead">{term.range}</p>
        {term.note ? <p className="meta">{term.note}</p> : null}
      </header>

      <section className="section compact-section">
        <div className="section-head"><div><div className="eyebrow">Course content</div><h2>Classes &amp; review</h2></div></div>
        <div className="compact-session-list">
          {term.sessions.map((session) => (
            <Link className="compact-session-row" href={`/living-lam-rim/${term.slug}/${session.slug}`} key={session.id}>
              <span className="compact-session-code">{session.code}</span>
              <span className="compact-session-copy"><strong>{session.label}</strong><small>{session.date} · {session.duration}</small></span>
              {session.transcriptSource ? <span className="compact-session-note">Transcript</span> : null}
              <span className="compact-row-arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
