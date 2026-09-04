import Link from 'next/link'
import { notFound } from 'next/navigation'
import LocalSessionTime from '@/components/local-session-time'
import NextClassCountdown from '@/components/next-class-countdown'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'
import rawCourse18Schedule from '@/content/classics/course-18-schedule.json'

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
type ScheduleItem = { label: string; date: string }
type ArchiveCourse = {
  canonicalNumber: number
  offerings?: ArchiveOffering[]
  sourceTimezone?: string
  schedule?: ScheduleItem[]
}
type ArchiveCatalog = { courses: ArchiveCourse[] }
type DetailedSchedule = {
  sourceTimezone: string
  sourceLabel: string
  sessions: Array<{ id: string; label: string; startsAt: string; endsAt: string; rebroadcastAt?: string | null }>
}

const catalog = rawCatalog as CanonicalCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog
const course18Schedule = rawCourse18Schedule as DetailedSchedule

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

function offeringMeta(offering: ArchiveOffering) {
  if (offering.recordingCount != null) return `${offering.recordingCount} recordings`
  if (offering.sessionCount != null) return `${offering.sessionCount} sessions`
  return ''
}

export default function ClassicsCourseHub({ courseSlug }: { courseSlug: string }) {
  const course = catalog.find((item) => item.slug === courseSlug)
  if (!course) notFound()

  const archive = archiveCatalog.courses.find((item) => item.canonicalNumber === course.canonicalNumber)
  const offerings = archive?.offerings ?? []
  const schedule = archive?.schedule ?? []
  const detailedSchedule = course.canonicalNumber === 18 ? course18Schedule.sessions : []

  return (
    <main className="container page compact-course-hub">
      <div className="offering-breadcrumbs"><Link href="/courses">Classics Courses</Link><span>/</span><span>Course {course.canonicalNumber}</span></div>

      <header className="compact-page-head">
        <div className="eyebrow">Classics Course {course.canonicalNumber}</div>
        <h1>{course.title}</h1>
      </header>

      {offerings.length ? (
        <section className="section compact-section">
          <div className="section-head"><div><div className="eyebrow">Course Offerings</div><h2>Choose a course</h2></div></div>
          <div className="compact-offering-list">
            {offerings.map((offering) => {
              const href = offering.internalHref ?? `/courses/${course.slug}/${offering.slug}`
              return (
                <div className="compact-offering-row" key={offering.slug}>
                  <Link className="compact-offering-main" href={href}>
                    <strong>{offering.label}</strong>
                    {offeringMeta(offering) ? <span>{offeringMeta(offering)}</span> : null}
                    <span className="compact-row-arrow" aria-hidden="true">→</span>
                  </Link>
                  {!offering.internalHref && offering.playlistUrl ? <a className="inline-library-link" href={offering.playlistUrl} target="_blank" rel="noreferrer">YouTube playlist ↗</a> : null}
                </div>
              )
            })}
          </div>
        </section>
      ) : detailedSchedule.length ? (
        <section className="section compact-section">
          <div className="section-head"><div><div className="eyebrow">Upcoming course</div><h2>Classes 1–10</h2></div></div>
          <NextClassCountdown sessions={detailedSchedule} />
          <div className="compact-schedule-list">
            {detailedSchedule.map((item) => (
              <div className="compact-schedule-row" key={item.id}>
                <div className="compact-schedule-code">{item.label.replace('Classes ', 'C')}</div>
                <div className="compact-schedule-copy">
                  <strong>{item.label}</strong>
                  <LocalSessionTime compact startsAt={item.startsAt} endsAt={item.endsAt} rebroadcastAt={item.rebroadcastAt} sourceTimezone={course18Schedule.sourceTimezone} sourceLabel={course18Schedule.sourceLabel} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : schedule.length ? (
        <section className="section compact-section">
          <div className="section-head"><div><div className="eyebrow">Upcoming course</div><h2>Scheduled classes</h2></div></div>
          <div className="compact-session-list">
            {schedule.map((item) => <div className="compact-session-static" key={`${item.label}-${item.date}`}><strong>{item.label}</strong><span>{dateLabel(item.date)}</span></div>)}
          </div>
        </section>
      ) : (
        <section className="section compact-section"><p className="meta">No verified Course Offering has been attached yet.</p></section>
      )}
    </main>
  )
}
