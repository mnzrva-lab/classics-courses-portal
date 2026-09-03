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

type Catalog = {
  terms: Term[]
}

const catalog = rawCatalog as Catalog

export default async function LivingLamRimTermPage({ params }: { params: Promise<{ termSlug: string }> }) {
  const { termSlug } = await params
  const term = catalog.terms.find((item) => item.slug === termSlug)
  if (!term) notFound()

  return (
    <main className="container page living-lam-rim-term-page">
      <div className="offering-breadcrumbs">
        <Link href="/living-lam-rim">Living Lam Rim</Link><span>/</span>
        <span>Term {term.term}</span>
      </div>

      <header className="living-term-course-head">
        <div className="eyebrow">Term {term.term}</div>
        <h1>{term.title ?? `Term ${term.term}`}</h1>
        <div className="living-term-course-meta">
          <span>{term.range}</span>
          <span>{term.sessions.length} recordings</span>
        </div>
        {term.note ? <p className="meta" style={{ marginTop: 12 }}>{term.note}</p> : null}
      </header>

      <section className="section living-term-study-section">
        <div className="living-term-study-head">
          <div className="eyebrow">Course content</div>
          <h2>Classes &amp; review</h2>
        </div>

        <div className="module-list">
          {term.sessions.map((session) => (
            <Link className="module" key={session.id} href={`/living-lam-rim/${term.slug}/${session.slug}`}>
              <div className="module-num">{session.code}</div>
              <div>
                <b>{session.label}</b>
                <small>{session.date} · {session.duration}</small>
              </div>
              <span className="status">Recording{session.transcriptSource ? ' · Transcript' : ''}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
