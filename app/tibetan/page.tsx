import Link from 'next/link'

export default function TibetanPage() {
  return (
    <main className="container page">
      <div className="eyebrow">Tibetan</div>
      <h1>Tibetan glossary</h1>
      <p className="lead">The Tibetan glossary is being kept as a separate study tool rather than mixed into course transcripts.</p>

      <section className="section card sage">
        <h2 style={{ fontSize: 32 }}>A dedicated tool</h2>
        <p>Course pages can link here when Tibetan terminology needs a deeper reference. The glossary itself will remain its own project so it can grow independently from the teaching portal.</p>
        <p className="meta">The dedicated glossary link will be added here once that project is ready.</p>
      </section>

      <section className="section"><Link className="button" href="/courses">← Back to Courses</Link></section>
    </main>
  )
}
