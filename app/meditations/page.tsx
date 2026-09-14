import Link from 'next/link'
import rawCatalog from '@/content/classics/catalog.json'
import rawCourse8 from '@/content/classics/course-08/taiwan-2026.json'
import { allArchiveSessions } from '@/content/classics/archive-sessions'

type CanonicalCourse = { canonicalNumber: number; slug: string; title: string }
type Course8Session = { id: string; slug: string; label: string; kind: string; date: string; teacher: string; recordingUrl: string | null }
type Course8Data = { course: { canonicalNumber: number; slug: string; title: string }; offering: { label: string }; sessions: Course8Session[] }

type MeditationVersion = {
  id: string
  courseNumber: number
  sourceLabel: string
  offeringLabel: string
  sessionLabel: string
  teacher: string
  date: string
  duration: string
  durationSeconds: number | null
  href: string
}

const catalog = rawCatalog as CanonicalCourse[]
const course8 = rawCourse8 as Course8Data
const courseByNumber = new Map(catalog.map((course) => [course.canonicalNumber, course]))

function displayTeacher(value?: string) {
  if (!value) return ''
  return value.replace(/\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}$/, '').trim()
}
function secondsFromDuration(value: string) {
  const parts = value.split(':').map(Number)
  if (parts.some(Number.isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}
function isMeditationRecording(code: string, name: string) {
  const normalized = `${code} ${name}`.toLowerCase()
  return normalized.includes('meditation') || /^m\d*\b/.test(normalized)
}
function matchesDuration(seconds: number | null, filter: string) {
  if (filter === 'all') return true
  if (seconds == null) return false
  if (filter === 'ten') return seconds <= 10 * 60
  if (filter === 'under30') return seconds < 30 * 60
  if (filter === '30to60') return seconds >= 30 * 60
  return true
}

const archiveVersions: MeditationVersion[] = allArchiveSessions()
  .filter((item) => isMeditationRecording(item.code, item.name))
  .map((item) => {
    const course = courseByNumber.get(item.courseNumber)
    const directHref = item.videoId
      ? `/archive/classics/${course?.slug ?? `course-${item.courseNumber}`}/${item.offeringSlug}/video-${item.videoId}`
      : `/courses/${course?.slug ?? `course-${item.courseNumber}`}/${item.offeringSlug}`
    return {
      id: `course-${item.courseNumber}-${item.offeringSlug}-${item.videoId ?? item.code}`,
      courseNumber: item.courseNumber,
      sourceLabel: course ? `Classics Course ${course.canonicalNumber} · ${course.title}` : `Classics Course ${item.courseNumber}`,
      offeringLabel: item.offeringLabel,
      sessionLabel: `${item.code} · ${item.name}`,
      teacher: displayTeacher(item.teacher),
      date: item.date ?? '',
      duration: item.duration,
      durationSeconds: secondsFromDuration(item.duration),
      href: directHref,
    }
  })

const course8Versions: MeditationVersion[] = course8.sessions
  .filter((session) => session.kind === 'Meditation' && Boolean(session.recordingUrl))
  .map((session) => ({
    id: `course-8-taiwan-${session.id}`,
    courseNumber: 8,
    sourceLabel: `Classics Course 8 · ${course8.course.title}`,
    offeringLabel: course8.offering.label,
    sessionLabel: session.label,
    teacher: session.teacher,
    date: session.date,
    duration: '',
    durationSeconds: null,
    href: `/courses/course-8/taiwan-2026/${session.slug}`,
  }))

const versions = [...archiveVersions, ...course8Versions]
const filters = [
  { value: 'all', label: 'All' },
  { value: 'ten', label: '10 minutes' },
  { value: 'under30', label: 'Under 30 min' },
  { value: '30to60', label: '30–60 min' },
]

export default async function MeditationsPage({ searchParams }: { searchParams: Promise<{ duration?: string }> }) {
  const params = await searchParams
  const durationFilter = filters.some((filter) => filter.value === params.duration) ? params.duration! : 'all'
  const filtered = versions.filter((item) => matchesDuration(item.durationSeconds, durationFilter))

  return (
    <main className="container page meditation-library-simple">
      <header className="compact-page-head">
        <div className="eyebrow">Practice library</div>
        <h1>Meditations</h1>
        <p className="lead">Meditation recordings identified inside reviewed Course Offerings, kept with their original course context.</p>
      </header>

      <section className="section compact-section">
        <nav className="meditation-filter-buttons" aria-label="Filter meditations by duration">
          {filters.map((filter) => <Link className={durationFilter === filter.value ? 'button sage' : 'button'} href={filter.value === 'all' ? '/meditations' : `/meditations?duration=${filter.value}`} key={filter.value}>{filter.label}</Link>)}
        </nav>

        {filtered.length ? (
          <div className="compact-session-list meditation-session-list">
            {filtered.map((item) => (
              <Link className="compact-session-row meditation-session-row" href={item.href} key={item.id}>
                <span className="compact-session-code">◎</span>
                <span className="compact-session-copy">
                  <strong className="meditation-course-name">{item.sourceLabel}</strong>
                  <span>{item.sessionLabel} · {item.offeringLabel}</span>
                  <small>{[item.teacher, item.date, item.duration].filter(Boolean).join(' · ')}</small>
                </span>
                <span className="compact-row-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : <p className="meta">No meditation recordings match this duration.</p>}
      </section>
    </main>
  )
}
