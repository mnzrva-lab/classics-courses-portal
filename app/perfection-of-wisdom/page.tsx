import Link from 'next/link'
import { perfectionGroups, perfectionProgram } from '@/content/perfection-of-wisdom/catalog'

export default function PerfectionOfWisdomPage() {
  return (
    <main className="container page perfection-page">
      <header className="compact-page-head">
        <div className="eyebrow">{perfectionProgram.eyebrow}</div>
        <h1>{perfectionProgram.title}</h1>
        <p className="lead">{perfectionProgram.subtitle}</p>
        <p>{perfectionProgram.intro}</p>
        <a className="inline-library-link" href={perfectionProgram.playlistUrl} target="_blank" rel="noreferrer">Open playlist on YouTube ↗</a>
      </header>

      <section className="section compact-section">
        <div className="section-head"><div><div className="eyebrow">Course content</div><h2>Sessions</h2><p>Sessions are grouped by the teaching period in which they were offered.</p></div></div>
        <div className="perfection-period-list">
          {perfectionGroups.map((period) => (
            <section className="perfection-period" key={period.id}>
              <h3>{period.title}</h3>
              <div className="compact-session-list">
                {period.sessions.map((session) => (
                  <Link className="compact-session-row" href={`/perfection-of-wisdom/${period.slug}/${session.slug}`} key={session.id}>
                    <span className="compact-session-code">{session.code}</span>
                    <span className="compact-session-copy">
                      <strong>{session.name}</strong>
                      <small>{[session.teacher, session.date].filter(Boolean).join(' · ')}</small>
                    </span>
                    <span className="compact-session-duration">{session.duration}</span>
                    {session.transcriptSource ? <span className="compact-session-note">Transcript</span> : null}
                    <span className="compact-row-arrow" aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  )
}
