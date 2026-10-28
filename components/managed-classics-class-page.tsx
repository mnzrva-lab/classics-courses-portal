import Link from 'next/link'
import LibraryClassHeader from '@/components/library-class-header'
import LibraryClassSection from '@/components/library-class-section'
import LibraryTranscriptReader from '@/components/library-transcript-reader'
import TranscriptNotice from '@/components/transcript-notice'
import RecordingPlayer from '@/components/recording-player'
import MarkdownContent from '@/components/markdown-content'
import ClassSequenceNavigation from '@/components/class-sequence-navigation'
import ManagedLibraryDownloadLinks from '@/components/managed-library-download-links'
import type { PublishedLibraryClassContent } from '@/lib/managed-library-content'

export default function ManagedClassicsClassPage({ record, courseSlug }: {
  record: PublishedLibraryClassContent
  courseSlug: string
}) {
  const { offering, session, transcript, studyNotes } = record
  const index = offering.sessions.findIndex(item => item.slug === session.slug)
  const previous = index > 0 ? offering.sessions[index - 1] : null
  const next = index + 1 < offering.sessions.length ? offering.sessions[index + 1] : null
  const download = (content: 'notes' | 'transcript') => (
    <ManagedLibraryDownloadLinks courseSlug={courseSlug} offeringSlug={offering.offeringSlug}
      sessionSlug={session.slug} content={content} />
  )
  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/courses">Classics Courses</Link><span>/</span>
        <Link href={offering.href}>{offering.offeringLabel}</Link><span>/</span>
        <span>{session.code}</span>
      </div>
      <LibraryClassHeader eyebrow={offering.kind + ' · ' + offering.offeringLabel}
        title={session.title}
        meta={[session.date, session.teacher, session.duration].filter(Boolean).join(' · ')} />
      <LibraryClassSection id="recording" eyebrow="Recording" title="Class recording">
        <RecordingPlayer recordingUrl={session.recordingUrl ?? null}
          title={offering.programTitle + ' · ' + session.title} />
      </LibraryClassSection>
      {studyNotes ? (
        <LibraryClassSection id="study-notes" eyebrow="Study Notes" title="Study Notes">
          {download('notes')}
          <div className="study-notes-copy"><MarkdownContent content={studyNotes} /></div>
        </LibraryClassSection>
      ) : null}
      <LibraryClassSection id="transcript" eyebrow="Reference Transcript"
        title={transcript ? 'Reference Transcript' : 'Transcript not added yet'}>
        {transcript ? (
          <>
            <TranscriptNotice />
            {download('transcript')}
            <LibraryTranscriptReader chapters={transcript.chapters}
              programTitle={offering.programTitle} sessionTitle={session.title}
              sessionDate={session.date ?? ''} sessionPath={session.href} />
          </>
        ) : <p className="meta">{session.transcript
          ? 'The transcript is temporarily unavailable.'
          : 'A Reference Transcript has not been added for this class yet.'}</p>}
      </LibraryClassSection>
      {session.materials?.length ? (
        <LibraryClassSection eyebrow="Materials" title="Reading and resources">
          <ul>{session.materials.map(m => (
            <li key={m.url}><a className="inline-library-link" href={m.url}
              target="_blank" rel="noreferrer">{m.label}</a></li>
          ))}</ul>
        </LibraryClassSection>
      ) : null}
      <ClassSequenceNavigation previous={previous ? { href: previous.href, label: previous.code } : null}
        next={next ? { href: next.href, label: next.code } : null}
        allHref={offering.href} allLabel="All classes" />
    </main>
  )
}
