import Link from 'next/link'
import { eyeOfCourageProgram } from '@/content/eye-of-courage'
import { getStandaloneTeachings } from '@/lib/standalone-content'

export const revalidate = 60

export default async function OtherProgramsPage() {
  const teachings = await getStandaloneTeachings()
  return (
    <main className="container page">
      <div className="eyebrow">Other Programs</div>
      <h1>Other teachings</h1>
      <p className="lead">Special teachings and study programs that sit outside the 18 Classics Courses.</p>

      <section className="section eoc-other-program-list">
        <Link className="card eoc-other-program-card" href="/other-programs/eye-of-courage">
          <div className="eoc-other-program-image"><img src={eyeOfCourageProgram.coverPath} alt="Tigers overlooking Guadalajara at sunset" /></div>
          <div>
            <div className="eyebrow">Special teaching · Casa Tartuk</div>
            <h2>{eyeOfCourageProgram.title}</h2>
            <p className="lead">{eyeOfCourageProgram.subtitle}</p>
            <p className="meta">{eyeOfCourageProgram.location} · {eyeOfCourageProgram.dates}</p>
            <span className="inline-library-link">Open teaching →</span>
          </div>
        </Link>
        {teachings.map(teaching => (
          <Link key={teaching.teachingSlug}
            className={'card eoc-other-program-card' + (teaching.cover ? '' : ' no-cover')}
            href={teaching.href}>
            {teaching.cover ? (
              <div className="eoc-other-program-image">
                <img src={teaching.cover} alt={teaching.artworkAlt ?? teaching.title} loading="lazy" />
              </div>
            ) : null}
            <div>
              <div className="eyebrow">Standalone teaching</div>
              <h2>{teaching.title}</h2>
              {teaching.subtitle ? <p className="lead">{teaching.subtitle}</p> : null}
              {(teaching.teacher || teaching.date) ? (
                <p className="meta">{[teaching.teacher, teaching.date].filter(Boolean).join(' · ')}</p>
              ) : null}
              <span className="inline-library-link">Open teaching</span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  )
}
