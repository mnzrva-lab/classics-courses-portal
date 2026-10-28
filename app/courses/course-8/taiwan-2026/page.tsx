import Link from 'next/link'
import LibrarySessionList from '@/components/library-session-list'
import LibraryCourseHero from '@/components/library-course-hero'
import rawCourseData from '@/content/classics/course-08/taiwan-2026.json'
import rawCatalog from '@/content/classics/catalog.json'

type CourseSession = {
  id: string
  slug: string
  label: string
  kind: string
  date: string
  teacher: string
  startsAt: string
  endsAt: string
  recordingUrl: string | null
  transcriptSource: string | null
  studyNotesSource?: string | null
}

type CourseData = {
  course: {
    canonicalNumber: number
    slug: string
    title: string
    fullTitle: string
  }
  offering: {
    slug: string
    label: string
    location: string
    year: number
    startsOn: string
    endsOn: string
    languages: string[]
    teachers: string[]
    sourceTimezone: string
  }
  sessions: CourseSession[]
}

const courseData = rawCourseData as CourseData
const catalog = rawCatalog as Array<{ canonicalNumber: number; artwork?: string; artworkAlt?: string }>

function sessionMarker(session: CourseSession) {
  const match = session.label.match(/(\d+)$/)
  const number = match?.[1] ?? ''
  if (session.kind === 'Meditation') return `M${number}`
  if (session.kind === 'Class') return `C${number}`
  return '•'
}

function availability(session: CourseSession) {
  const available: string[] = []
  if (session.recordingUrl) available.push('Recording')
  if (session.transcriptSource) available.push('Transcript')
  if (session.studyNotesSource) available.push('Study Notes')
  return available.length ? available.join(' · ') : 'Scheduled archive'
}

export default function Course8TaiwanPage() {
  const { course, offering, sessions } = courseData
  const courseArtwork = catalog.find((item) => item.canonicalNumber === course.canonicalNumber)

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/courses">Classics Courses</Link><span>/</span>
        <span>Course {course.canonicalNumber}</span><span>/</span>
        <span>{offering.label}</span>
      </div>

      <LibraryCourseHero
        eyebrow={'Classics Course ' + course.canonicalNumber + ' · ' + offering.label}
        title={course.title}
        artwork={courseArtwork?.artwork ? {
          src: courseArtwork.artwork,
          alt: courseArtwork.artworkAlt ?? course.title,
          width: 1920,
          height: 1080,
        } : undefined}
        subtitle={'with ' + offering.teachers.join(' and ')}
        facts={['Aug 18-22, 2026', offering.location, offering.languages.join(' · ')]}
      />

      <section className="section">
        <div className="offering-section-head">
          <div>
            <div className="eyebrow">Course content</div>
            <h2>Classes &amp; meditations</h2>
            <p>This Course Offering is served from the GitHub Library snapshot and does not require Supabase to load.</p>
          </div>
        </div>

        <LibrarySessionList rows={sessions.map((session) => ({
          href: `/courses/course-8/taiwan-2026/${session.slug}`,
          code: sessionMarker(session),
          title: session.label,
          meta: `${session.date}${session.teacher ? ` · ${session.teacher}` : ''}`,
          status: availability(session),
        }))} />
      </section>
    </main>
  )
}
