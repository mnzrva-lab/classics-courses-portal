import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordingPlayer from '@/components/recording-player'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'
import { archiveSessionBySlug, archiveSessionSlug } from '@/content/classics/archive-route'

type CanonicalCourse = { canonicalNumber: number; slug: string; title: string }
type ArchiveOffering = { slug: string; label: string; sourceLabel: string; note?: string }
type ArchiveCourse = { canonicalNumber: number; offerings?: ArchiveOffering[] }
type ArchiveCatalog = { courses: ArchiveCourse[] }

const catalog = rawCatalog as CanonicalCourse[]
const archiveCatalog = rawArchiveCatalog as ArchiveCatalog

function displayTeacher(value?: string) {
  if (!value) return ''
  return value.replace(/\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}$/, '').trim()
}

export default async function ClassicsArchiveSessionPage({ params }: { params: Promise<{ courseSlug: string; offeringSlug: string; sessionSlug: string }> }) {
  const { courseSlug, offeringSlug, sessionSlug } = await params
  const course = catalog.find((item) => item.slug === courseSlug)
  if (!course) notFound()

  const archive = archiveCatalog.courses.find((item) => item.canonicalNumber === course.canonicalNumber)
  const offering = archive?.offerings?.find((item) => item.slug === offeringSlug)
  if (!offering) notFound()

  const resolved = archiveSessionBySlug(course.canonicalNumber, offeringSlug, sessionSlug)
  if (!resolved) notFound()
  const { session, index, sessions } = resolved
  const teacher = displayTeacher(session.teacher)
  const previous = index > 0 ? sessions[index - 1] : null
  const next = index < sessions.length - 1 ? sessions[index + 1] : null

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/courses">Classics Courses</Link><span>/</span>
        <Link href={`/courses/${course.slug}/${offering.slug}`}>Course {course.canonicalNumber} · {offering.label}</Link><span>/</span>
        <span>{session.code}</span>
      </div>

      <section className="section">
        <div className="eyebrow">Classics Course {course.canonicalNumber} · {offering.label}</div>
        <h1>{session.name}</h1>
        <p className="lead">{[session.date, teacher, session.duration].filter(Boolean).join(' · ') || offering.sourceLabel}</p>
      </section>

      <section className="section" id="recording">
        <div className="eyebrow">Recording</div>
        <h2>Class recording</h2>
        <RecordingPlayer recordingUrl={session.url} title={`Classics Course ${course.canonicalNumber} · ${offering.label} · ${session.name}`} />
      </section>

      <section className="section transcript-section-v12" id="transcript">
        <div className="eyebrow">Reference Transcript</div>
        <h2>Transcript not added yet</h2>
        <p className="meta">The verified recording is available, but a Reference Transcript has not been added to the Library for this class yet.</p>
        {offering.note ? <p className="meta" style={{ marginTop: 12 }}>{offering.note}</p> : null}
      </section>

      <nav className="section" aria-label="Archive session navigation">
        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <div>{previous ? <Link className="button" href={`/archive/classics/${course.slug}/${offering.slug}/${archiveSessionSlug(previous, index - 1)}`}>← {previous.code || 'Previous'}</Link> : null}</div>
          <Link className="button" href={`/courses/${course.slug}/${offering.slug}`}>All classes</Link>
          <div>{next ? <Link className="button" href={`/archive/classics/${course.slug}/${offering.slug}/${archiveSessionSlug(next, index + 1)}`}>{next.code || 'Next'} →</Link> : null}</div>
        </div>
      </nav>
    </main>
  )
}
