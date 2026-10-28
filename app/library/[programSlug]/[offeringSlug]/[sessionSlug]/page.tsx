import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibraryClassHeader from '@/components/library-class-header'
import LibraryClassSection from '@/components/library-class-section'
import LibraryTranscriptReader from '@/components/library-transcript-reader'
import TranscriptNotice from '@/components/transcript-notice'
import RecordingPlayer from '@/components/recording-player'
import MarkdownContent from '@/components/markdown-content'
import ClassSequenceNavigation from '@/components/class-sequence-navigation'
import ManagedLibraryDownloadLinks from '@/components/managed-library-download-links'
import { getPublishedLibraryClass } from '@/lib/managed-library-content'

export const revalidate = 60
type Params = { programSlug: string; offeringSlug: string; sessionSlug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { programSlug, offeringSlug, sessionSlug } = await params
  const record = await getPublishedLibraryClass(programSlug, offeringSlug, sessionSlug)
  if (!record) return {}
  const { offering, session } = record
  return {
    title: offering.programTitle + ' · ' + session.title,
    ...(offering.source === 'existing-aci17'
      ? { robots: { index: false, follow: true }, alternates: { canonical: session.href } } : {}),
  }
}
export default async function PublishedClassPage({ params }: { params: Promise<Params> }) {
  const { programSlug, offeringSlug, sessionSlug } = await params
  const record = await getPublishedLibraryClass(programSlug, offeringSlug, sessionSlug)
  if (!record) notFound()
  const { offering, session, transcript, studyNotes } = record
  const index = offering.sessions.findIndex(s => s.slug === session.slug)
  const previous = index > 0 ? offering.sessions[index - 1] : null
  const next = index < offering.sessions.length - 1 ? offering.sessions[index + 1] : null
  const sessionPath = '/library/' + programSlug + '/' + offeringSlug + '/' + sessionSlug

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/library">Teaching Library</Link><span>/</span>
        <Link href={'/library/' + programSlug + '/' + offeringSlug}>{offering.offeringLabel}</Link>
        <span>/</span><span>{session.code}</span>
      </div>
      <LibraryClassHeader
        eyebrow={offering.kind + ' · ' + offering.offeringLabel}
        title={session.title}
        meta={[session.date, session.teacher, session.duration].filter(Boolean).join(' · ')}
      />
      <LibraryClassSection id="recording" eyebrow="Recording" title="Class recording">
        <RecordingPlayer recordingUrl={session.recordingUrl ?? null} title={offering.programTitle + ' · ' + session.title} />
      </LibraryClassSection>
      {studyNotes ? (
        <LibraryClassSection id="study-notes" eyebrow="Study Notes" title="Study Notes">
          <ManagedLibraryDownloadLinks programSlug={programSlug} offeringSlug={offeringSlug} sessionSlug={sessionSlug} content="notes" />
          <div className="study-notes-copy"><MarkdownContent content={studyNotes} /></div>
        </LibraryClassSection>
      ) : null}
      <LibraryClassSection id="transcript" eyebrow="Reference Transcript" title={transcript ? 'Reference Transcript' : 'Transcript not added yet'}>
        {transcript ? (
          <>
            <TranscriptNotice />
            <ManagedLibraryDownloadLinks programSlug={programSlug} offeringSlug={offeringSlug} sessionSlug={sessionSlug} content="transcript" />
            <LibraryTranscriptReader
              chapters={transcript.chapters}
              programTitle={offering.programTitle}
              sessionTitle={session.title}
              sessionDate={session.date ?? ''}
              sessionPath={sessionPath}
            />
          </>
        ) : (
          <p className="meta">{session.transcript
            ? 'The transcript is temporarily unavailable.'
            : 'A Reference Transcript has not been added for this class yet.'}</p>
        )}
      </LibraryClassSection>
      {session.materials?.length ? (
        <LibraryClassSection eyebrow="Materials" title="Reading and resources">
          <ul>{session.materials.map(m => (
            <li key={m.url}><a className="inline-library-link" href={m.url} target="_blank" rel="noreferrer">{m.label}</a></li>
          ))}</ul>
        </LibraryClassSection>
      ) : null}
      <ClassSequenceNavigation
        previous={previous ? { href: previous.href, label: previous.code } : null}
        next={next ? { href: next.href, label: next.code } : null}
        allHref={'/library/' + programSlug + '/' + offeringSlug}
        allLabel="All classes"
      />
    </main>
  )
}
