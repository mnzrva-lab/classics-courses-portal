import Link from 'next/link'
import { notFound } from 'next/navigation'
import RecordingPlayer from '@/components/recording-player'
import courseData from '@/content/classics/course-08/taiwan-2026.json'

export default async function Course8TaiwanSessionPage({ params }: { params: Promise<{ sessionSlug: string }> }) {
  const { sessionSlug } = await params
  const session = courseData.sessions.find((item) => item.slug === sessionSlug)
  if (!session) notFound()

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
        <p className="lead">{session.date} · {session.teacher}</p>
      </section>

      <section className="section">
        <div className="eyebrow">Recording</div>
        <h2>Class recording</h2>
        <RecordingPlayer recordingUrl={session.recordingUrl} title={`${courseData.course.fullTitle} · ${session.label}`} />
      </section>

      <section className="section">
        <div className="eyebrow">Reference Transcript</div>
        <h2>Transcript migration in progress</h2>
        <p>The transcript source has been recovered from the earlier Course 8 prototype. It is being moved into the GitHub Library in verified batches so paragraph structure and future timestamp anchors are preserved.</p>
      </section>
    </main>
  )
}
