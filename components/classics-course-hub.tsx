import Link from 'next/link'
import LibraryCourseHero from '@/components/library-course-hero'
import { notFound } from 'next/navigation'
import LibrarySessionList from '@/components/library-session-list'
import { archiveSessionsFor } from '@/content/classics/archive-sessions'
import { archiveSessionSlug } from '@/content/classics/archive-route'
import { getCourse18Schedule } from '@/lib/course18-content'
import { individualCourse18Classes, formatCourse18Date, formatCourse18ClassTime } from '@/lib/course18-individual-classes'
import NextClassCountdown from '@/components/next-class-countdown'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'

type CanonicalCourse = { canonicalNumber: number; slug: string; title: string; artwork?: string; artworkAlt?: string }
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
const catalog = rawCatalog as CanonicalCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))
}

function offeringMeta(offering: ArchiveOffering) {
  if (offering.recordingCount != null) return `${offering.recordingCount} recordings`
  if (offering.sessionCount != null) return `${offering.sessionCount} sessions`
  return ''
}

export default async function ClassicsCourseHub({ courseSlug }: { courseSlug: string }) {
  const course = catalog.find((item) => item.slug === courseSlug)
  if (!course) notFound()

  const archive = archiveCatalog.courses.find((item) => item.canonicalNumber === course.canonicalNumber)
  const offerings = archive?.offerings ?? []
  const schedule = archive?.schedule ?? []
  const course16Sessions = course.canonicalNumber === 16 ? archiveSessionsFor(16, 'archive-2025-2026') : []
  const course18Schedule = course.canonicalNumber === 18 ? await getCourse18Schedule() : null
  const detailedSchedule = course18Schedule?.sessions ?? []
  const course18Classes = course18Schedule ? individualCourse18Classes(course18Schedule) : []

  return (
    <main className="container page compact-course-hub">
      <div className="offering-breadcrumbs"><Link href="/courses">Classics Courses</Link><span>/</span><span>Course {course.canonicalNumber}</span></div>

      <LibraryCourseHero
        eyebrow={'Classics Course ' + course.canonicalNumber}
        title={course.title}
        artwork={course.artwork ? {
          src: course.artwork,
          alt: course.artworkAlt ?? course.title,
          width: 1920,
          height: 1080,
        } : undefined}
      />

      {course16Sessions.length ? (
        <section className="section compact-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">Course content · Arizona 2025–2026</div>
              <h2>Classes 1–10</h2>
              <p>Ten recorded classes. Select a class to open its recording and study page.</p>
            </div>
          </div>
          <LibrarySessionList rows={course16Sessions.map((session, index) => ({
            href: '/archive/classics/course-16/archive-2025-2026/' + archiveSessionSlug(session, index),
            code: session.code,
            title: session.name,
            meta: session.date ?? '',
            status: 'Recording' + (session.duration ? ' · ' + session.duration : ''),
          }))} />
          {offerings[0]?.playlistUrl ? (
            <p className="meta" style={{ marginTop: 16 }}>
              <a className="inline-library-link" href={offerings[0].playlistUrl} target="_blank" rel="noreferrer">Open full course playlist on YouTube ↗</a>
            </p>
          ) : null}
        </section>
      ) : offerings.length ? (
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
      ) : course18Classes.length ? (
        <section className="section compact-section">
          <div className="section-head">
            <div>
              <div className="eyebrow">Course content · Arizona 2026–2027</div>
              <h2>Classes 1–10</h2>
              <p>Ten classes across five teaching dates. Each date has two classes; recordings and study materials will be linked separately.</p>
            </div>
          </div>
          <NextClassCountdown sessions={detailedSchedule} />
          <LibrarySessionList rows={course18Classes.map((item) => ({
            href: item.href,
            code: 'C' + item.number,
            title: item.title,
            meta: formatCourse18Date(item.block.startsAt),
            status: formatCourse18ClassTime(item),
          }))} />
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
