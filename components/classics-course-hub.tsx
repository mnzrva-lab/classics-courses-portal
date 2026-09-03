import Link from 'next/link'
import { notFound } from 'next/navigation'
import LocalSessionTime from '@/components/local-session-time'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'
import rawCourse18Schedule from '@/content/classics/course-18-schedule.json'

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

type DetailedSchedule = {
  sourceTimezone: string
  sourceLabel: string
  sessions: Array<{ id: string; label: string; startsAt: string; endsAt: string; rebroadcastAt?: string | null }>
}

const catalog = rawCatalog as CanonicalCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog
const course18Schedule = rawCourse18Schedule as DetailedSchedule

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
  const detailedSchedule = course.canonicalNumber === 18 ? course18Schedule.sessions : []

  return (
    <main className="container page">
      <div className="offering-breadcrumbs"><Link href="/courses">Classics Courses</Link><span>/</span><span>Course {course.canonicalNumber}</span></div>

      <section className="section">
        <div className="eyebrow">Classics Course {course.canonicalNumber}</div>
        <h1>{course.title}</h1>
        <p className="lead">{offerings.length ? 'Choose the Course Offering or teaching archive you want to study.' : detailedSchedule.length ? 'Upcoming live teaching schedule.' : 'Teaching archive.'}</p>
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
                  {!offering.internalHref ? <Link className="button sage" href={`/courses/${course.slug}/${offering.slug}`}>Open Course Offering</Link> : null}
                  {!offering.internalHref && offering.playlistUrl ? <a className="button" href={offering.playlistUrl} target="_blank" rel="noreferrer">Playlist ↗</a> : null}
                </div>
              </article>
            ))}
          </div>
          <p className="meta" style={{ marginTop: 18 }}>Only teaching archives verified in the supplied source material are shown. Individual class pages will be added as their recording and transcript data is migrated into the Library.</p>
        </section>
      ) : detailedSchedule.length ? (
        <section className="section">
          <div className="section-head"><div><div className="eyebrow">Upcoming course</div><h2>Classes 1–10</h2><p>Your local time is shown first. Arizona source time remains visible underneath.</p></div></div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {detailedSchedule.map((item) => <div className="program-session-row" key={item.id}>
              <div className="program-session-code">{item.label.replace('Classes ', 'C')}</div>
              <div className="program-session-copy"><h3 style={{ margin: 0 }}>{item.label}</h3><LocalSessionTime startsAt={item.startsAt} endsAt={item.endsAt} rebroadcastAt={item.rebroadcastAt} sourceTimezone={course18Schedule.sourceTimezone} sourceLabel={course18Schedule.sourceLabel} /></div>
            </div>)}
          </div>
          <p className="meta" style={{ marginTop: 14 }}>The supplied schedule includes a 4:00 p.m. Arizona rebroadcast. This public page intentionally does not expose the Zoom registration link.</p>
        </section>
      ) : schedule.length ? (
        <section className="section">
          <div className="section-head"><div><div className="eyebrow">Upcoming course</div><h2>Scheduled classes</h2></div></div>
          <div className="card">
            {schedule.map((item) => <div className="home-milestone-row" key={`${item.label}-${item.date}`}><strong className="home-milestone-date">{dateLabel(item.date)}</strong><div><h3>{item.label}</h3><p>Classics Course {course.canonicalNumber}</p></div></div>)}
          </div>
        </section>
      ) : (
        <section className="section"><div className="card cream"><h2>Teaching archive being organized</h2><p className="meta">No verified teaching archive has been attached to this course yet.</p></div></section>
      )}
    </main>
  )
}
