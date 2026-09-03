import Link from 'next/link'
import { notFound } from 'next/navigation'
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

type ScheduleItem = {
  label: string
  date: string
}

type ArchiveCourse = {
  canonicalNumber: number
  offerings?: ArchiveOffering[]
  status?: string
  sourceTimezone?: string
  schedule?: ScheduleItem[]
}

type ArchiveCatalog = {
  schemaVersion: number
  source: string
  courses: ArchiveCourse[]
}

const catalog = rawCatalog as CanonicalCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog

function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function offeringMeta(offering: ArchiveOffering) {
  if (offering.recordingCount != null) return `${offering.recordingCount} recordings · YouTube`
  if (offering.sessionCount != null) return `${offering.sessionCount} sessions · Library archive`
  return 'Teaching archive'
}

export default function ClassicsCourseHub({ courseSlug }: { courseSlug: string }) {
  const course = catalog.find((item) => item.slug === courseSlug)
  if (!course) notFound()

  const archive = archiveCatalog.courses.find((item) => item.canonicalNumber === course.canonicalNumber)
  const offerings = archive?.offerings ?? []
  const schedule = archive?.schedule ?? []

  return (
    <main className="container page">
      <div className="offering-breadcrumbs"><Link href="/courses">Classics Courses</Link><span>/</span><span>Course {course.canonicalNumber}</span></div>

      <section className="section">
        <div className="eyebrow">Classics Course {course.canonicalNumber}</div>
        <h1>{course.title}</h1>
        <p className="lead">Choose the Course Offering or teaching archive you want to study.</p>
      </section>

      {offerings.length ? (
        <section className="section">
          <div className="section-head"><div><div className="eyebrow">Teaching archive</div><h2>{offerings.length === 1 ? 'Available Course Offering' : 'Available Course Offerings'}</h2></div></div>
          <div className="grid two">
            {offerings.map((offering) => (
              <article className="card" key={offering.slug}>
                <div className="eyebrow">Course Offering</div>
                <h2 style={{ fontSize: 30 }}>{offering.label}</h2>
                <p className="meta">{offeringMeta(offering)}</p>
                {offering.note ? <p className="meta" style={{ marginTop: 12 }}>{offering.note}</p> : null}
                <div className="actions" style={{ marginTop: 16 }}>
                  {offering.internalHref ? <Link className="button sage" href={offering.internalHref}>Open Library archive</Link> : null}
                  {!offering.internalHref && offering.playlistUrl ? <a className="button sage" href={offering.playlistUrl} target="_blank" rel="noreferrer">Open full playlist ↗</a> : null}
                </div>
              </article>
            ))}
          </div>
          <p className="meta" style={{ marginTop: 18 }}>Only teaching archives verified in the supplied source material are shown. Individual class pages will be added as their recording and transcript data is migrated into the Library.</p>
        </section>
      ) : schedule.length ? (
        <section className="section">
          <div className="section-head"><div><div className="eyebrow">Upcoming course</div><h2>Scheduled classes</h2></div></div>
          <div className="card">
            {schedule.map((item) => <div className="home-milestone-row" key={`${item.label}-${item.date}`}><strong className="home-milestone-date">{dateLabel(item.date)}</strong><div><h3>{item.label}</h3><p>Classics Course {course.canonicalNumber}</p></div></div>)}
          </div>
          <p className="meta" style={{ marginTop: 14 }}>Source timezone: Arizona. This page intentionally does not expose the class Zoom link. Session-level local-time display and live access will be restored only with the reviewed schedule workflow.</p>
        </section>
      ) : (
        <section className="section"><div className="card cream"><h2>Teaching archive being organized</h2><p className="meta">No verified teaching archive has been attached to this course yet.</p></div></section>
      )}
    </main>
  )
}
