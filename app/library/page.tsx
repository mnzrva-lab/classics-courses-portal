import Link from 'next/link'
import LibrarySessionList from '@/components/library-session-list'
import { getPublishedLibraryOfferings } from '@/lib/managed-library-content'

export const revalidate = 60

/** New published offerings register themselves here without a website deploy. */
export default async function PublishedLibraryIndexPage() {
  const offerings = await getPublishedLibraryOfferings()
  return (
    <main className="container page">
      <div className="eyebrow">Published teachings</div>
      <h1>Teaching Library</h1>
      <p className="lead">
        Browse approved course offerings and their class recordings, transcripts and study materials.
      </p>
      <section className="section compact-section" aria-label="Published course offerings">
        <div className="section-head">
          <div><div className="eyebrow">Available offerings</div><h2>Courses and programs</h2></div>
        </div>
        {offerings.length ? (
          <LibrarySessionList rows={offerings.map(offering => ({
            href: offering.href,
            code: offering.kind,
            title: offering.programTitle,
            meta: offering.offeringLabel,
            status: offering.sessions.length + ' class' + (offering.sessions.length === 1 ? '' : 'es'),
          }))} />
        ) : (
          <p className="meta">The published catalog is temporarily unavailable. Existing course links remain available in their respective sections.</p>
        )}
        <p className="meta" style={{ marginTop: 18 }}>
          <Link className="inline-library-link" href="/courses">Explore the 18 Classics Courses</Link>
        </p>
      </section>
    </main>
  )
}
