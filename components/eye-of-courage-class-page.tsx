import Link from 'next/link'
import LibraryClassHeader from '@/components/library-class-header'
import LibraryClassSection from '@/components/library-class-section'
import ClassSequenceNavigation from '@/components/class-sequence-navigation'
import EyeOfCourageTabs from '@/components/eye-of-courage-tabs'
import EyeOfCourageWorkshopShell from '@/components/eye-of-courage-workshop-shell'
import MarkdownContent from '@/components/markdown-content'
import RecordingPlayer from '@/components/recording-player'
import TranscriptControls from '@/components/transcript-controls'
import TranscriptQuickNav from '@/components/transcript-quick-nav'
import LibraryTranscriptReader from '@/components/library-transcript-reader'
import {
  eyeOfCourageProgram,
  eyeOfCourageSession,
  eyeOfCourageSessions,
  eyeOfCourageStudyNotes,
  eyeOfCourageTranscripts,
} from '@/content/eye-of-courage'

export default function EyeOfCourageClassPage({ sessionSlug }: { sessionSlug: 'class-1' | 'class-2' }) {
  const session = eyeOfCourageSession(sessionSlug)
  if (!session) return null

  const index = eyeOfCourageSessions.findIndex((item) => item.slug === session.slug)
  const previous = index > 0 ? eyeOfCourageSessions[index - 1] : null
  const next = index < eyeOfCourageSessions.length - 1 ? eyeOfCourageSessions[index + 1] : null
  const notes = eyeOfCourageStudyNotes[session.id] ?? null
  const transcript = eyeOfCourageTranscripts[session.id] ?? []

  const transcriptPanel = (
    <div id="transcript" style={{ scrollMarginTop: 96 }}>
      <div className="eyebrow">Reference Transcript</div>
      <h2>Reference Transcript</h2>
      <div className="info-callout">
        <strong>About this transcript</strong><br />
        This transcript was created by a student with AI and should be used for reference only. Please check it against the video and audio for accuracy of content.
      </div>
      {transcript.length ? <>
        <TranscriptControls chapters={transcript.map((chapter) => ({ id: chapter.id, label: chapter.title }))} />
        <LibraryTranscriptReader chapters={transcript} programTitle={eyeOfCourageProgram.title} sessionTitle={session.label} sessionDate={session.date} sessionPath={`/other-programs/eye-of-courage/${session.slug}`} />
        <TranscriptQuickNav />
      </> : <p className="meta">Transcript not added yet.</p>}
    </div>
  )

  const notesPanel = notes ? (
    <div id="study-notes" style={{ scrollMarginTop: 96 }}>
      <div className="eyebrow">Study aid</div>
      <h2>Study Notes</h2>
      <div className="info-callout">
        <strong>About these notes</strong><br />
        These study notes were created from the class with the assistance of AI and are provided as a study aid. They may simplify or omit parts of the teaching. Please refer to the recording and transcript for the complete class.
      </div>
      <div className="study-notes-summary card">
        <div className="eyebrow">Covered in this class</div>
        <h3>Top ideas</h3>
        <p>{notes.summary}</p>
        <div className="study-topic-list">{notes.topics.map((topic) => <span className="pill" key={topic}>{topic}</span>)}</div>
        <div className="full-study-notes-body eoc-notes-body"><MarkdownContent content={notes.markdown} /></div>
      </div>
    </div>
  ) : undefined

  const workshopPanel = session.hasWorkshop ? (
    <div id="workshop" style={{ scrollMarginTop: 96 }}>
      <EyeOfCourageWorkshopShell />
    </div>
  ) : undefined

  return (
    <main className="container page eoc-class-page">
      <div className="offering-breadcrumbs"><Link href="/other-programs">Other Programs</Link><span>/</span><Link href="/other-programs/eye-of-courage">{eyeOfCourageProgram.title}</Link><span>/</span><span>{session.label}</span></div>

      <LibraryClassHeader
        className="eoc-class-head"
        eyebrow={eyeOfCourageProgram.title + ' · ' + eyeOfCourageProgram.subtitle}
        title={session.label}
        meta={session.date + ' · ' + session.teacher}
      />

      <LibraryClassSection id="recording" className="eoc-recording-section" eyebrow="Recording" title="Class recording">
        <RecordingPlayer recordingUrl={session.recordingUrl} title={`${eyeOfCourageProgram.title} · ${session.label}`} />
      </LibraryClassSection>

      <EyeOfCourageTabs transcript={transcriptPanel} studyNotes={notesPanel} workshop={workshopPanel} />

      <ClassSequenceNavigation
        previous={previous ? { href: `/other-programs/eye-of-courage/${previous.slug}`, label: previous.label } : null}
        next={next ? { href: `/other-programs/eye-of-courage/${next.slug}`, label: next.label } : null}
        allHref="/other-programs/eye-of-courage"
        allLabel="All classes"
      />
    </main>
  )
}
