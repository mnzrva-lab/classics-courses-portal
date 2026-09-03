import Link from 'next/link'

const plannedFilters = [
  'Duration',
  'Topic',
  'Teacher',
  'Source course or program',
]

export default function MeditationsPage() {
  return (
    <main className="container page meditation-library-simple">
      <div className="eyebrow">Practice library</div>
      <h1>Meditations</h1>
      <p className="lead">A dedicated meditation library is part of the portal architecture, with one canonical practice able to collect multiple teaching versions.</p>

      <section className="section">
        <div className="card cream">
          <div className="eyebrow">Content migration</div>
          <h2>The meditation catalog is being populated from reviewed source material.</h2>
          <p>We have the library structure, but the supplied project files do not contain the standalone canonical meditation records or audio catalog needed to publish this area accurately.</p>
          <p className="meta">Meditations that already belong to migrated course archives remain available inside their source courses. We will group them here only after the canonical practice data is recovered or supplied.</p>
          <div className="actions"><Link className="button sage" href="/courses">Browse current teaching archives</Link></div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><div className="eyebrow">Planned library tools</div><h2>How this area will work</h2></div></div>
        <div className="grid two">
          <div className="card">
            <h3>Find the right practice</h3>
            <p className="meta">The reviewed catalog will support the filters already designed for the portal.</p>
            <div className="actions">{plannedFilters.map((item) => <span className="pill" key={item}>{item}</span>)}</div>
          </div>
          <div className="card">
            <h3>Practice-first playback</h3>
            <p className="meta">Dedicated audio will be used when available, while each version can keep its link back to the source class, Study Notes, and transcript context.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
