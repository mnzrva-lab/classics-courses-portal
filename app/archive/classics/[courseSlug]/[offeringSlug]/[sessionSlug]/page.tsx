export const revalidate = 60

import Link from 'next/link'
import LibraryClassHeader from '@/components/library-class-header'
import LibraryClassSection from '@/components/library-class-section'
import TranscriptNotice from '@/components/transcript-notice'
import ClassSequenceNavigation from '@/components/class-sequence-navigation'
import { notFound } from 'next/navigation'
import RecordingPlayer from '@/components/recording-player'
import TimedArchiveTranscript from '@/components/timed-archive-transcript'
import ACI17PreviewReader from '@/components/aci17-preview-reader'
import { getACI17Manifest, getACI17Transcript } from '@/lib/aci17-published-content'
import { getManagedClassicsClass } from '@/lib/classics-managed-content'
import ManagedClassicsClassPage from '@/components/managed-classics-class-page'
import ContentDownloadLinks from '@/components/content-download-links'
import rawCatalog from '@/content/classics/catalog.json'
import rawArchiveCatalog from '@/content/classics/archive-catalog.json'
import { archiveSessionBySlug, archiveSessionSlug } from '@/content/classics/archive-route'
import { timedTranscriptFor } from '@/content/classics/timed-transcripts'

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

  const managedClass = await getManagedClassicsClass(courseSlug, offeringSlug, sessionSlug)
  if (managedClass) return <ManagedClassicsClassPage record={managedClass} courseSlug={courseSlug} />

  const archive = archiveCatalog.courses.find((item) => item.canonicalNumber === course.canonicalNumber)
  const offering = archive?.offerings?.find((item) => item.slug === offeringSlug)
  if (!offering) notFound()

  const publishedACI17 = course.canonicalNumber === 17 && offeringSlug === 'current-2026'
    ? await getACI17Manifest()
    : null
  const resolved = publishedACI17
    ? (() => {
        const sessions = publishedACI17.offering.sessions
        const index = sessions.findIndex((session, i) => archiveSessionSlug(session, i) === sessionSlug)
        return index < 0 ? null : { session: sessions[index], index, sessions }
      })()
    : archiveSessionBySlug(course.canonicalNumber, offeringSlug, sessionSlug)
  if (!resolved) notFound()
  const { session, index, sessions } = resolved
  const teacher = displayTeacher(session.teacher)
  const previous = index > 0 ? sessions[index - 1] : null
  const next = index < sessions.length - 1 ? sessions[index + 1] : null
  const timedTranscript = publishedACI17 ? null : timedTranscriptFor(course.canonicalNumber, offeringSlug, session.code)
  const publishedTranscript = publishedACI17
    ? await getACI17Transcript(session.code, session.videoId)
    : null

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/courses">Classics Courses</Link><span>/</span>
        <Link href={`/courses/${course.slug}/${offering.slug}`}>Course {course.canonicalNumber} · {offering.label}</Link><span>/</span>
        <span>{session.code}</span>
      </div>

      <LibraryClassHeader
        eyebrow={'Classics Course ' + course.canonicalNumber + ' · ' + offering.label}
        title={session.name}
        meta={[session.date, teacher, session.duration].filter(Boolean).join(' · ') || offering.sourceLabel}
      />

      <LibraryClassSection id="recording" eyebrow="Recording" title="Class recording">
        <RecordingPlayer recordingUrl={session.url} title={`Classics Course ${course.canonicalNumber} · ${offering.label} · ${session.name}`} />
      </LibraryClassSection>

      <LibraryClassSection id="transcript" className="transcript-section-v12" eyebrow="Reference Transcript" title={publishedTranscript || timedTranscript ? 'Reference Transcript' : 'Transcript not added yet'}>
        {publishedTranscript || timedTranscript ? <TranscriptNotice /> : null}
        {publishedTranscript ? (
          <>
            <ContentDownloadLinks collection="course17" sessionId={session.code} content="transcript" />
            <ACI17PreviewReader transcript={publishedTranscript} sessionTitle={session.name} sessionDate={session.date ?? ''} sessionPath={`/archive/classics/${course.slug}/${offering.slug}/${sessionSlug}`} />
          </>
        ) : timedTranscript ? (
          <TimedArchiveTranscript
            transcript={timedTranscript}
            sessionTitle={session.name}
            sessionDate={session.date ?? ''}
            sessionPath={`/archive/classics/${course.slug}/${offering.slug}/${sessionSlug}`}
          />
        ) : (
          <>
            <p className="meta">The verified recording is available, but a Reference Transcript has not been added to the Library for this class yet.</p>
            {offering.note ? <p className="meta" style={{ marginTop: 12 }}>{offering.note}</p> : null}
          </>
        )}
      </LibraryClassSection>

      <ClassSequenceNavigation
        previous={previous ? {
          href: '/archive/classics/' + course.slug + '/' + offering.slug + '/' + archiveSessionSlug(previous, index - 1),
          label: previous.code || 'Previous',
        } : null}
        next={next ? {
          href: '/archive/classics/' + course.slug + '/' + offering.slug + '/' + archiveSessionSlug(next, index + 1),
          label: next.code || 'Next',
        } : null}
        allHref={'/courses/' + course.slug + '/' + offering.slug}
        allLabel="All classes"
      />
    </main>
  )
}
