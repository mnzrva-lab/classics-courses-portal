import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibrarySessionList from '@/components/library-session-list'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'
import { archiveSessionsFor } from '@/content/classics/archive-sessions'
import { archiveSessionSlug } from '@/content/classics/archive-route'

type CanonicalCourse = { canonicalNumber: number; slug: string; title: string }
type ArchiveOffering = {
  slug: string
  label: string
  sourceLabel: string
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

  const archive = archiveCatalog.courses.find((item) => item.canonicalNumber === course.canonicalNumber)
  const offering = archive?.offerings?.find((item) => item.slug === offeringSlug)
  if (!offering) notFound()

  const sessions = archiveSessionsFor(course.canonicalNumber, offering.slug)

  if (offering.internalHref) {
    return (
      <main className="container page">
        <div className="offering-breadcrumbs"><Link href="/courses">Classics Courses</Link><span>/</span><Link href={`/courses/${course.slug}`}>Course {course.canonicalNumber}</Link><span>/</span><span>{offering.label}</span></div>
        <section className="section"><div className="eyebrow">Course Offering</div><h1>{course.title}</h1><p className="lead">{offering.label}</p><Link className="inline-library-link" href={offering.internalHref}>Open course →</Link></section>
      </main>
    )
  }

  return (
    <main className="container page compact-offering-page">
      <div className="offering-breadcrumbs"><Link href="/courses">Classics Courses</Link><span>/</span><Link href={`/courses/${course.slug}`}>Course {course.canonicalNumber}</Link><span>/</span><span>{offering.label}</span></div>

      <header className="compact-page-head">
        <div className="eyebrow">Classics Course {course.canonicalNumber} · Course Offering</div>
        <h1>{course.title}</h1>
        <p className="lead">{offering.label}</p>
        {offering.playlistUrl ? <a className="inline-library-link" href={offering.playlistUrl} target="_blank" rel="noreferrer">Open playlist on YouTube ↗</a> : null}
      </header>

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
          {offering.note ? <p className="meta" style={{ marginTop: 12 }}>{offering.note}</p> : null}
        </section>
      ) : (
        <section className="section compact-section"><p className="meta">Individual class pages will appear here as verified source data is connected.</p></section>
      )}
    </main>
  )
}
