import Link from 'next/link'
import { perfectionGroups, perfectionProgram } from '@/content/perfection-of-wisdom/catalog'

export default function PerfectionOfWisdomPage() {
  const totalSessions = perfectionGroups.reduce((sum, group) => sum + group.sessions.length, 0)
  const transcriptCount = perfectionGroups.reduce((sum, group) => sum + group.sessions.filter((session) => Boolean(session.transcriptSource)).length, 0)

  return (
    <main className="container page perfection-page">
      <section className="offering-hero no-artwork">
        <div className="offering-hero-copy">
          <div className="eyebrow">{perfectionProgram.eyebrow}</div>
          <h1 className="offering-title">{perfectionProgram.title}</h1>
          <p className="lead">{perfectionProgram.subtitle}</p>
          <p>{perfectionProgram.intro}</p>
          <div className="offering-meta">
            <span className="pill">{perfectionGroups.length} archive groups</span>
            <span className="pill">{totalSessions} recordings</span>
            <span className="pill">{transcriptCount} transcript migrated</span>
            <span className="pill">{perfectionProgram.facts.majorRealizations} major realizations</span>
            <span className="pill">{perfectionProgram.facts.topicsOnPath} topics on the path</span>
          </div>
          <div className="actions" style={{ marginTop: 20 }}>
            <a className="button" href={perfectionProgram.playlistUrl} target="_blank" rel="noreferrer">Open full YouTube playlist ↗</a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Teaching archive</div>
            <h2>Sessions by archive group</h2>
            <p>The source archive is preserved as supplied, including its original group labels and repeated session codes.</p>
          </div>
        </div>

        <div className="home-explore-grid">
          {perfectionGroups.map((group) => {
            const first = group.sessions[0]
            const last = group.sessions[group.sessions.length - 1]
            return (
              <Link className="card home-library-card" href={`/perfection-of-wisdom/${group.slug}`} key={group.id}>
                <div className="eyebrow">{group.sessions.length} recording{group.sessions.length === 1 ? '' : 's'}</div>
                <h3>{group.title}</h3>
                <p className="meta">{first?.date}{last && last.date !== first?.date ? ` – ${last.date}` : ''}</p>
                <div className="go">Open archive group →</div>
              </Link>
            )
          })}
        </div>
      </section>
    </main>
  )
}
