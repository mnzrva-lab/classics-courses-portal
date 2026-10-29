import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibraryCourseHero from '@/components/library-course-hero'
import { perfectionGroupBySlug, perfectionProgram } from '@/content/perfection-of-wisdom/catalog'

export default async function PerfectionGroupPage({ params }: { params: Promise<{ groupSlug: string }> }) {
  const { groupSlug } = await params
  const group = perfectionGroupBySlug(groupSlug)
  if (!group) notFound()

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/perfection-of-wisdom">Perfection of Wisdom</Link><span>/</span>
        <span>{group.title}</span>
      </div>

      <LibraryCourseHero
        eyebrow={perfectionProgram.eyebrow}
        title={group.title}
        facts={[group.sessions.length + ' recording' + (group.sessions.length === 1 ? '' : 's')]}
      />

      <section className="section living-term-study-section">
        <div className="living-term-study-head">
          <div className="eyebrow">Archive content</div>
          <h2>Sessions</h2>
        </div>

        <div className="module-list">
          {group.sessions.map((session) => (
            <Link className="module" key={session.id} href={`/perfection-of-wisdom/${group.slug}/${session.slug}`}>
              <div className="module-num">{session.code}</div>
              <div>
                <b>{session.name}</b>
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
