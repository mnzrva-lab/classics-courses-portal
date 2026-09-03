import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordingPlayer from '@/components/recording-player'
import rawCourseData from '@/content/classics/course-08/taiwan-2026.json'
import med2Part1 from '@/content/classics/course-08/taiwan-2026/meditation-2/transcript-part-1.json'
import med2Part2 from '@/content/classics/course-08/taiwan-2026/meditation-2/transcript-part-2.json'
import med2Part3 from '@/content/classics/course-08/taiwan-2026/meditation-2/transcript-part-3.json'

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

type TranscriptParagraph = {
  id: string
  speaker: string
  text: string
}

type TranscriptChapter = {
  id: string
  title: string
  paragraphs: TranscriptParagraph[]
}

const courseData = rawCourseData as CourseData
const meditation2Transcript = [
  ...med2Part1.chapters,
  ...med2Part2.chapters,
  ...med2Part3.chapters,
] as TranscriptChapter[]

function transcriptForSession(sessionId: string) {
  return sessionId === 'med2' ? meditation2Transcript : []
}

export default async function Course8TaiwanSessionPage({ params }: { params: Promise<{ sessionSlug: string }> }) {
  const { sessionSlug } = await params
  const session = courseData.sessions.find((item) => item.slug === sessionSlug)
  if (!session) notFound()

  const transcriptChapters = transcriptForSession(session.id)
  const transcriptRecovered = transcriptChapters.length > 0 || Boolean(session.transcriptSource)
  const studyNotesRecovered = Boolean(session.studyNotesSource)

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

      {studyNotesRecovered ? (
        <section className="section" id="study-notes">
          <div className="eyebrow">Study Notes</div>
          <h2>Study Notes recovered</h2>
          <p>The complete Study Notes source is now stored in the GitHub Library. Rendering the Markdown directly on this page is the next small migration step.</p>
        </section>
      ) : null}

      <section className="section transcript-section-v12" id="transcript">
        <div className="eyebrow">Reference Transcript</div>
        <h2>{transcriptRecovered ? 'Reference Transcript' : 'Transcript not added yet'}</h2>

        {transcriptChapters.length > 0 ? (
          <>
            <div className="info-callout">
              <strong>About this transcript</strong><br />
              This transcript was created by a student with AI and should be used for reference only. Please check it against the video and audio for accuracy of content.
            </div>

            <nav className="actions" aria-label="Transcript chapters" style={{ marginTop: 18, marginBottom: 28 }}>
              {transcriptChapters.map((chapter) => (
                <a className="button" href={`#${chapter.id}`} key={chapter.id}>{chapter.title}</a>
              ))}
            </nav>

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
