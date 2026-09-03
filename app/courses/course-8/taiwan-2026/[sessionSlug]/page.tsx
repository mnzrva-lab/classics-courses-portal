import Link from 'next/link'
import { notFound } from 'next/navigation'
import MarkdownContent from '@/components/markdown-content'
import RecordingPlayer from '@/components/recording-player'
import TranscriptControls from '@/components/transcript-controls'
import rawCourseData from '@/content/classics/course-08/taiwan-2026.json'
import { course8StudyNotesForSession } from '@/content/classics/course-08/taiwan-2026/study-notes'
import { course8TranscriptForSession } from '@/content/classics/course-08/taiwan-2026/transcripts'

type CourseSession = {
  id: string
  slug: string
  label: string
  kind: string
  date: string
  teacher: string
  recordingUrl: string | null
  transcriptSource: string | null
  studyNotesSource?: string | null
}

type CourseData = {
  course: {
    fullTitle: string
  }
  sessions: CourseSession[]
}

const courseData = rawCourseData as CourseData

export default async function Course8TaiwanSessionPage({ params }: { params: Promise<{ sessionSlug: string }> }) {
  const { sessionSlug } = await params
  const session = courseData.sessions.find((item) => item.slug === sessionSlug)
  if (!session) notFound()

  const transcriptChapters = course8TranscriptForSession(session.id)
  const studyNotes = course8StudyNotesForSession(session.id)
  const transcriptRecovered = transcriptChapters.length > 0 || Boolean(session.transcriptSource)
  const studyNotesRecovered = Boolean(studyNotes) || Boolean(session.studyNotesSource)

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/courses">Classics Courses</Link><span>/</span>
        <Link href="/courses/course-8/taiwan-2026">Course 8 · Taiwan 2026</Link><span>/</span>
        <span>{session.label}</span>
      </div>

      <section className="section">
        <div className="eyebrow">Classics Course 8 · Taiwan 2026</div>
        <h1>{session.label}</h1>
        <p className="lead">{session.date}{session.teacher ? ` · ${session.teacher}` : ''}</p>
      </section>

      <section className="section">
        <div className="eyebrow">Recording</div>
        <h2>{session.recordingUrl ? 'Class recording' : 'Recording not added yet'}</h2>
        <RecordingPlayer recordingUrl={session.recordingUrl} title={`${courseData.course.fullTitle} · ${session.label}`} />
      </section>

      {studyNotes ? (
        <section className="section" id="study-notes" style={{ scrollMarginTop: 96 }}>
          <div className="study-notes-head">
            <div><div className="eyebrow">Study aid</div><h2>Study Notes</h2></div>
          </div>
          <div className="info-callout">
            <strong>About these notes</strong><br />
            These study notes were created from the class with the assistance of AI and are provided as a study aid. They may simplify or omit parts of the teaching. Please refer to the recording and transcript for the complete class.
          </div>
          <div className="study-notes-summary card">
            <div className="eyebrow">Covered in this {session.kind === 'Meditation' ? 'meditation' : 'class'}</div>
            <h3>Top ideas</h3>
            <p>{studyNotes.summary}</p>
            <div className="study-topic-list">
              {studyNotes.topics.map((topic) => <span className="pill" key={topic}>{topic}</span>)}
            </div>
            <details className="full-study-notes">
              <summary>▶ View full study notes</summary>
              <div className="full-study-notes-body"><MarkdownContent content={studyNotes.markdown} /></div>
            </details>
          </div>
        </section>
      ) : studyNotesRecovered ? (
        <section className="section" id="study-notes">
          <div className="eyebrow">Study Notes</div>
          <h2>Study Notes recovered</h2>
          <p>The complete Study Notes source is stored in the GitHub Library and will be connected to this page during its content migration.</p>
        </section>
      ) : null}

      <section className="section transcript-section-v12" id="transcript" style={{ scrollMarginTop: 96 }}>
        <div className="eyebrow">Reference Transcript</div>
        <h2>{transcriptRecovered ? 'Reference Transcript' : 'Transcript not added yet'}</h2>

        {transcriptChapters.length > 0 ? (
          <>
            <div className="info-callout">
              <strong>About this transcript</strong><br />
              This transcript was created by a student with AI and should be used for reference only. Please check it against the video and audio for accuracy of content.
            </div>

            <TranscriptControls chapters={transcriptChapters.map((chapter) => ({ id: chapter.id, label: chapter.title }))} />

            <article className="transcript-v12-card">
              {transcriptChapters.map((chapter) => (
                <section key={chapter.id} id={chapter.id} style={{ scrollMarginTop: 96, marginBottom: 34 }}>
                  <h3>{chapter.title}</h3>
                  {chapter.paragraphs.map((paragraph) => (
                    <div
                      className="transcript-paragraph-v12"
                      data-transcript-paragraph
                      id={paragraph.id}
                      key={paragraph.id}
                      style={{ scrollMarginTop: 96 }}
                    >
                      <div className="transcript-copy">
                        <strong>{paragraph.speaker}: </strong>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{paragraph.text}</span>
                      </div>
                      <div className="meta" style={{ marginTop: 8 }}>
                        <a href={`#${paragraph.id}`}>§ {paragraph.id}</a>
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </article>
          </>
        ) : transcriptRecovered ? (
          <p>The transcript source has been recovered from the earlier Course 8 prototype and is being moved into the GitHub Library in verified batches.</p>
        ) : (
          <p>No transcript source is currently attached to this session. We will add it when the source material is provided.</p>
        )}
      </section>
    </main>
  )
}
