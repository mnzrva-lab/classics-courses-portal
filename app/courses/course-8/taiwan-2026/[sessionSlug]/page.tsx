import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordingPlayer from '@/components/recording-player'
import rawCourseData from '@/content/classics/course-08/taiwan-2026.json'

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

  const transcriptRecovered = Boolean(session.transcriptSource)
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
        <section className="section">
          <div className="eyebrow">Study Notes</div>
          <h2>Study Notes recovered</h2>
          <p>The Study Notes source is now stored in the GitHub Library. Rendering it on this page is the next migration step.</p>
        </section>
      ) : null}

      <section className="section">
        <div className="eyebrow">Reference Transcript</div>
        <h2>{transcriptRecovered ? 'Transcript recovered' : 'Transcript not added yet'}</h2>
        {transcriptRecovered ? (
          <p>The transcript source has been recovered from the earlier Course 8 prototype. It is being moved into the GitHub Library in verified batches so paragraph structure and future timestamp anchors are preserved.</p>
        ) : (
          <p>No transcript source is currently attached to this session. We will add it when the source material is provided.</p>
        )}
      </section>
    </main>
  )
}
