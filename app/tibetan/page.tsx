import Link from 'next/link'

const plannedTools = [
  'Search by transliteration',
  'Search by English meaning',
  'Source references',
  'Course and session links',
  'Future flashcards',
]

export default function TibetanPage() {
  return (
    <main className="container page">
      <div className="eyebrow">Tibetan</div>
      <h1>Tibetan glossary</h1>
      <p className="lead">The glossary remains part of the Library plan, but its reviewed term data has not yet been migrated into the GitHub-backed public archive.</p>

      <section className="section">
        <div className="card cream">
          <div className="eyebrow">Content migration</div>
          <h2>Glossary terms will appear here after the source term set is recovered and reviewed.</h2>
          <p>We are keeping the existing database-backed glossary and study-progress work for a later account/sync phase rather than publishing incomplete or invented terminology.</p>
          <div className="actions"><Link className="button sage" href="/courses">Browse current teaching archives</Link></div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><div className="eyebrow">Planned glossary tools</div><h2>Built for study, not just a word list</h2></div></div>
        <div className="card">
          <div className="actions">{plannedTools.map((item) => <span className="pill" key={item}>{item}</span>)}</div>
          <p className="meta" style={{ marginTop: 16 }}>Personal bookmarks and learning progress will return when the private study layer is re-enabled.</p>
        </div>
      </section>
    </main>
  )
}
