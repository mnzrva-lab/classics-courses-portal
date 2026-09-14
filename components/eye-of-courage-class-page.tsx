import Link from 'next/link'
import ClassSequenceNavigation from '@/components/class-sequence-navigation'
import EyeOfCourageTabs from '@/components/eye-of-courage-tabs'
import EyeOfCourageWorkshop from '@/components/eye-of-courage-workshop'
import MarkdownContent from '@/components/markdown-content'
import RecordingPlayer from '@/components/recording-player'
import TranscriptControls from '@/components/transcript-controls'
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
        <article className="transcript-v12-card eoc-transcript-card">
          {transcript.map((chapter) => (
            <section key={chapter.id} id={chapter.id} style={{ scrollMarginTop: 96, marginBottom: 34 }}>
              <h3>{chapter.title}</h3>
              {chapter.paragraphs.map((paragraph) => (
                <div className="transcript-paragraph-v12" data-transcript-paragraph id={paragraph.id} key={paragraph.id} style={{ scrollMarginTop: 96 }}>
                  <div className="transcript-copy"><strong>{paragraph.speaker}: </strong><span style={{ whiteSpace: 'pre-wrap' }}>{paragraph.text}</span></div>
                </div>
              ))}
            </section>
          ))}
        </article>
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
      <EyeOfCourageWorkshop />
    </div>
  ) : undefined

  return (
    <main className="container page eoc-class-page">
      <div className="offering-breadcrumbs"><Link href="/other-programs">Other Programs</Link><span>/</span><Link href="/other-programs/eye-of-courage">{eyeOfCourageProgram.title}</Link><span>/</span><span>{session.label}</span></div>

      <header className="compact-page-head eoc-class-head">
        <div className="eyebrow">{eyeOfCourageProgram.title} · {eyeOfCourageProgram.subtitle}</div>
        <h1>{session.label}</h1>
        <p className="lead">{session.date} · {session.teacher}</p>
      </header>

      <section className="section eoc-recording-section" id="recording">
        <div className="eyebrow">Recording</div>
        <h2>Class recording</h2>
        <RecordingPlayer recordingUrl={session.recordingUrl} title={`${eyeOfCourageProgram.title} · ${session.label}`} />
      </section>

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
