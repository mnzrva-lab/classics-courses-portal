export const revalidate = 60

import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibrarySessionList from '@/components/library-session-list'
import LibraryCourseHero from '@/components/library-course-hero'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'
import { archiveSessionsFor } from '@/content/classics/archive-sessions'
import { archiveSessionSlug } from '@/content/classics/archive-route'
import { getACI17Manifest } from '@/lib/aci17-published-content'
import { getManagedClassicsOffering } from '@/lib/classics-managed-content'
import ManagedClassicsOfferingPage from '@/components/managed-classics-offering-page'

type CanonicalCourse = { canonicalNumber: number; slug: string; title: string; artwork?: string; artworkAlt?: string }
type ArchiveOffering = {
  slug: string
  label: string
  sourceLabel: string
  artwork?: string
  artworkAlt?: string
  playlistUrl?: string
  recordingCount?: number
  internalHref?: string
  sessionCount?: number
  note?: string
}
type ArchiveCourse = { canonicalNumber: number; offerings?: ArchiveOffering[] }
type ArchiveCatalog = { courses: ArchiveCourse[] }

const catalog = rawCatalog as CanonicalCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog

function displayTeacher(value?: string) {
  if (!value) return ''
  return value.replace(/\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}$/, '').trim()
}

export default async function CourseOfferingPage({ params }: { params: Promise<{ courseSlug: string; offeringSlug: string }> }) {
  const { courseSlug, offeringSlug } = await params
  const course = catalog.find((item) => item.slug === courseSlug)
  if (!course) notFound()

  const managed = await getManagedClassicsOffering(courseSlug, offeringSlug)
  if (managed) return <ManagedClassicsOfferingPage course={course} offering={managed} />

  const archive = archiveCatalog.courses.find((item) => item.canonicalNumber === course.canonicalNumber)
  const offering = archive?.offerings?.find((item) => item.slug === offeringSlug)
  if (!offering) notFound()

  const publishedACI17 = course.canonicalNumber === 17 && offering.slug === 'current-2026'
    ? await getACI17Manifest()
    : null
  const displayedOffering = publishedACI17 ? { ...offering, ...publishedACI17.offering } : offering
  const displayedTitle = publishedACI17?.title ?? course.title
  const sessions = publishedACI17?.offering.sessions ?? archiveSessionsFor(course.canonicalNumber, offering.slug)
  const artworkSrc = displayedOffering.artwork ?? publishedACI17?.artwork ?? course.artwork
  const artworkAlt = displayedOffering.artworkAlt ?? publishedACI17?.artworkAlt ?? course.artworkAlt ?? course.title

  if (offering.internalHref) {
    return (
      <main className="container page">
        <div className="offering-breadcrumbs"><Link href="/courses">Classics Courses</Link><span>/</span><Link href={`/courses/${course.slug}`}>Course {course.canonicalNumber}</Link><span>/</span><span>{offering.label}</span></div>
        <LibraryCourseHero
          eyebrow="Course Offering"
          title={displayedTitle}
          subtitle={displayedOffering.label}
          artwork={artworkSrc ? { src: artworkSrc, alt: artworkAlt, width: 1920, height: 1080 } : undefined}
        >
          <Link className="inline-library-link" href={offering.internalHref}>Open course →</Link>
        </LibraryCourseHero>
      </main>
    )
  }

  return (
    <main className="container page compact-offering-page">
      <div className="offering-breadcrumbs"><Link href="/courses">Classics Courses</Link><span>/</span><Link href={`/courses/${course.slug}`}>Course {course.canonicalNumber}</Link><span>/</span><span>{offering.label}</span></div>

      <LibraryCourseHero
        eyebrow={'Classics Course ' + course.canonicalNumber + ' · Course Offering'}
        title={displayedTitle}
        subtitle={displayedOffering.label}
        artwork={artworkSrc ? { src: artworkSrc, alt: artworkAlt, width: 1920, height: 1080 } : undefined}
      >
        {displayedOffering.playlistUrl ? (
          <a className="inline-library-link" href={displayedOffering.playlistUrl} target="_blank" rel="noreferrer">Open playlist on YouTube ↗</a>
        ) : null}
      </LibraryCourseHero>

      {sessions.length ? (
        <section className="section compact-section">
          <div className="section-head"><div><div className="eyebrow">Course content</div><h2>Classes &amp; recordings</h2></div></div>
          <LibrarySessionList rows={sessions.map((session, index) => {
            const teacher = displayTeacher(session.teacher)
            const sessionSlug = archiveSessionSlug(session, index)
            return {
              href: `/archive/classics/${course.slug}/${offering.slug}/${sessionSlug}`,
              code: session.code || `C${index + 1}`,
              title: session.name,
              meta: [session.date, teacher].filter(Boolean).join(' · ') || 'Source date not included',
              status: ['Recording', session.duration].filter(Boolean).join(' · '),
            }
          })} />
          {displayedOffering.note ? <p className="meta" style={{ marginTop: 12 }}>{displayedOffering.note}</p> : null}
        </section>
      ) : (
        <section className="section compact-section"><p className="meta">Individual class pages will appear here as verified source data is connected.</p></section>
      )}
    </main>
  )
}
