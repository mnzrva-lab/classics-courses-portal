import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibraryClassHeader from '@/components/library-class-header'
import LibraryClassSection from '@/components/library-class-section'
import ClassSequenceNavigation from '@/components/class-sequence-navigation'
import RecordingPlayer from '@/components/recording-player'
import { course18RecordingFor } from '@/lib/course18-recordings'
import { getCourse18Schedule } from '@/lib/course18-content'
import { individualCourse18Classes, formatCourse18Date, formatCourse18ClassTime } from '@/lib/course18-individual-classes'

export const dynamic = 'force-dynamic'

/** Schedule-first class pages; no recording or transcript is claimed without a source. */
export default async function Course18ClassPage({
  params,
}: { params: Promise<{ classSlug: string }> }) {
  const { classSlug } = await params
  const match = /^class-(10|[1-9])$/.exec(classSlug)
  if (!match) notFound()

  const schedule = await getCourse18Schedule()
  const classes = individualCourse18Classes(schedule)
  const index = classes.findIndex((item) => item.number === Number(match[1]))
  if (index === -1) notFound()

  const item = classes[index]
  const { block } = item
  const previous = classes[index - 1]
  const next = classes[index + 1]
  const recording = course18RecordingFor(item.number)

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/courses">Classics Courses</Link><span>/</span>
        <Link href="/courses/course-18">Course 18</Link><span>/</span>
        <span>{item.title}</span>
      </div>

      <LibraryClassHeader
        eyebrow="Classics Course 18 · The Great Ideas of Buddhism, Part III"
        title={item.title}
        meta={formatCourse18Date(block.startsAt) + ' · ' + formatCourse18ClassTime(item)}
      />

      <LibraryClassSection id="recording" eyebrow="Recording" title={recording ? 'Class recording' : 'Recording not added yet'}>
        {recording ? (
          <RecordingPlayer recordingUrl={recording.url} title={`Classics Course 18 · ${item.title}`} />
        ) : (
          <p className="meta">A recording for {item.title} has not yet been linked in the Library.</p>
        )}
      </LibraryClassSection>

      <LibraryClassSection id="transcript" eyebrow="Reference Transcript" title="Transcript not added yet">
        <p className="meta">Reference Transcript and study materials will appear here once verified sources are provided.</p>
      </LibraryClassSection>

      <ClassSequenceNavigation
        previous={previous ? { href: previous.href, label: previous.title } : null}
        next={next ? { href: next.href, label: next.title } : null}
        allHref="/courses/course-18"
      />
    </main>
  )
}
