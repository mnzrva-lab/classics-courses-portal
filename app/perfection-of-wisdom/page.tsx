import Link from 'next/link'
import MarkdownContent from '@/components/markdown-content'
import LibraryCourseHero from '@/components/library-course-hero'
import { readPublishedMarkdown } from '@/lib/public-content'
import { perfectionGroups, perfectionProgram } from '@/content/perfection-of-wisdom/catalog'

export const dynamic = 'force-dynamic'

export default async function PerfectionOfWisdomPage() {
  const externalIntro = await readPublishedMarkdown('perfection-of-wisdom/overview.md')
  // Editable GitHub Markdown owns every paragraph between the fixed title
  // and playlist link. Local fallback stays complete if GitHub is unavailable.
  const fallbackIntro = [perfectionProgram.subtitle, perfectionProgram.intro.replace(/^Root text\b/, '**Root text**')].join('\n\n')
  const intro = externalIntro ?? fallbackIntro

  return (
    <main className="container page perfection-page">
      <LibraryCourseHero eyebrow={perfectionProgram.eyebrow} title={perfectionProgram.title}>
        <div className="perfection-intro-markdown" data-content-origin={externalIntro ? 'private-github' : 'local'}>
          <MarkdownContent content={intro} />
        </div>
        <a className="inline-library-link" href={perfectionProgram.playlistUrl} target="_blank" rel="noreferrer">Open playlist on YouTube ↗</a>
      </LibraryCourseHero>

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
