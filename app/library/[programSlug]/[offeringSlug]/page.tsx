import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibraryCourseHero from '@/components/library-course-hero'
import LibrarySessionList from '@/components/library-session-list'
import { getPublishedLibraryOffering } from '@/lib/managed-library-content'

export const revalidate = 60
type Params = { programSlug: string; offeringSlug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { programSlug, offeringSlug } = await params
  const offering = await getPublishedLibraryOffering(programSlug, offeringSlug)
  if (!offering) return {}
  // The legacy ACI 17 pages are the canonical public addresses.
  return {
    title: offering.programTitle + ' · ' + offering.offeringLabel,
    ...(offering.source === 'existing-aci17'
      ? { robots: { index: false, follow: true }, alternates: { canonical: offering.href } } : {}),
  }
}
export default async function PublishedOfferingPage({ params }: { params: Promise<Params> }) {
  const { programSlug, offeringSlug } = await params
  const offering = await getPublishedLibraryOffering(programSlug, offeringSlug)
  if (!offering) notFound()

  return (
    <main className="container page compact-offering-page">
      <div className="offering-breadcrumbs">
        <Link href="/library">Teaching Library</Link><span>/</span><span>{offering.offeringLabel}</span>
      </div>
      <LibraryCourseHero
        eyebrow={offering.kind}
        title={offering.programTitle}
        subtitle={offering.offeringLabel}
        description={offering.description}
        artwork={offering.artwork ? {
          src: offering.artwork, alt: offering.artworkAlt ?? offering.programTitle,
          width: 1920, height: 1080,
        } : undefined}
      >
        {offering.playlistUrl ? (
          <a className="inline-library-link" href={offering.playlistUrl} target="_blank" rel="noreferrer">
            Open recording playlist
          </a>
        ) : null}
        {offering.source === 'existing-aci17' ? (
          <Link className="inline-library-link" href={offering.href}>Open the existing ACI 17 course page</Link>
        ) : null}
      </LibraryCourseHero>
      <section className="section compact-section">
        <div className="section-head">
          <div><div className="eyebrow">Course content</div><h2>Classes and materials</h2></div>
        </div>
        <LibrarySessionList rows={offering.sessions.map(session => ({
          href: session.href, code: session.code, title: session.title,
          meta: [session.date, session.teacher].filter(Boolean).join(' · '),
          status: [
            session.recordingUrl ? 'Recording' : null,
            session.transcript ? 'Transcript' : null,
            session.studyNotes ? 'Study Notes' : null,
          ].filter(Boolean).join(' · ') || 'Class details',
        }))} />
      </section>
    </main>
  )
}
