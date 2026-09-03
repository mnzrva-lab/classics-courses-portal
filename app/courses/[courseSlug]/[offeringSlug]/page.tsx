import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordingPlayer from '@/components/recording-player'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'

type CanonicalCourse = {
  canonicalNumber: number
  slug: string
  title: string
}

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

type ArchiveCourse = {
  canonicalNumber: number
  offerings?: ArchiveOffering[]
}

type ArchiveCatalog = {
  courses: ArchiveCourse[]
}

const catalog = rawCatalog as CanonicalCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog

export default async function CourseOfferingPage({ params }: { params: Promise<{ courseSlug: string; offeringSlug: string }> }) {
  const { courseSlug, offeringSlug } = await params
  const course = catalog.find((item) => item.slug === courseSlug)
  if (!course) notFound()

  const archive = archiveCatalog.courses.find((item) => item.canonicalNumber === course.canonicalNumber)
  const offering = archive?.offerings?.find((item) => item.slug === offeringSlug)
  if (!offering) notFound()

  if (offering.internalHref) {
    return (
      <main className="container page">
        <div className="offering-breadcrumbs"><Link href="/courses">Classics Courses</Link><span>/</span><Link href={`/courses/${course.slug}`}>Course {course.canonicalNumber}</Link><span>/</span><span>{offering.label}</span></div>
        <section className="section"><div className="eyebrow">Course Offering</div><h1>{course.title}</h1><p className="lead">{offering.label}</p><div className="actions"><Link className="button sage" href={offering.internalHref}>Open full Library archive</Link></div></section>
      </main>
    )
  }

  return (
    <main className="container page">
      <div className="offering-breadcrumbs"><Link href="/courses">Classics Courses</Link><span>/</span><Link href={`/courses/${course.slug}`}>Course {course.canonicalNumber}</Link><span>/</span><span>{offering.label}</span></div>

      <section className="section">
        <div className="eyebrow">Classics Course {course.canonicalNumber} · Course Offering</div>
        <h1>{course.title}</h1>
        <p className="lead">{offering.label}{offering.recordingCount != null ? ` · ${offering.recordingCount} recordings` : ''}</p>
        <div className="actions">{offering.playlistUrl ? <a className="button sage" href={offering.playlistUrl} target="_blank" rel="noreferrer">Open full playlist ↗</a> : null}</div>
      </section>

      {offering.playlistUrl ? (
        <section className="section">
          <div className="eyebrow">Recording archive</div>
          <h2>Course recordings</h2>
          <RecordingPlayer recordingUrl={offering.playlistUrl} title={`Classics Course ${course.canonicalNumber} · ${offering.label}`} />
        </section>
      ) : null}

      <section className="section">
        <div className="card cream">
          <div className="eyebrow">Library migration</div>
          <h2>Individual classes are being organized.</h2>
          <p>The verified full playlist is available now. Individual class rows, Study Notes, transcripts, timestamps, and materials will appear here as their source data is migrated into the Library.</p>
          {offering.note ? <p className="meta" style={{ marginTop: 12 }}>{offering.note}</p> : null}
        </div>
      </section>
    </main>
  )
}
