import Link from 'next/link'
import LibraryCourseHero from '@/components/library-course-hero'
import LibrarySessionList from '@/components/library-session-list'
import type { PublishedLibraryOffering } from '@/lib/managed-library-content'

type Course = { canonicalNumber: number; slug: string; title: string; artwork?: string; artworkAlt?: string }

/** An existing Classics offering page, using source data from private GitHub. */
export default function ManagedClassicsOfferingPage({
  course, offering,
}: { course: Course; offering: PublishedLibraryOffering }) {
  const cover = offering.artwork ?? course.artwork
  return (
    <main className="container page compact-offering-page">
      <div className="offering-breadcrumbs">
        <Link href="/courses">Classics Courses</Link><span>/</span>
        <Link href={'/courses/' + course.slug}>Course {course.canonicalNumber}</Link>
        <span>/</span><span>{offering.offeringLabel}</span>
      </div>
      <LibraryCourseHero
        eyebrow={'Classics Course ' + course.canonicalNumber + ' · Course Offering'}
        title={course.title}
        subtitle={offering.offeringLabel}
        description={offering.description}
        artwork={cover ? {
          src: cover, alt: offering.artworkAlt ?? course.artworkAlt ?? course.title,
          width: 1920, height: 1080,
        } : undefined}
      >
        {offering.playlistUrl ? (
          <a className="inline-library-link" href={offering.playlistUrl} target="_blank" rel="noreferrer">Open playlist on YouTube</a>
        ) : null}
      </LibraryCourseHero>
      <section className="section compact-section">
        <div className="section-head">
          <div><div className="eyebrow">Course content</div><h2>Classes &amp; recordings</h2></div>
        </div>
        <LibrarySessionList rows={offering.sessions.map(session => ({
          href: session.href,
          code: session.code,
          title: session.title,
          meta: [session.date, session.teacher].filter(Boolean).join(' · '),
          status: [
            session.recordingUrl ? 'Recording' : null,
            session.transcript ? 'Transcript' : null,
            session.studyNotes ? 'Study Notes' : null,
            session.duration,
          ].filter(Boolean).join(' · ') || 'Class details',
        }))} />
      </section>
    </main>
  )
}
