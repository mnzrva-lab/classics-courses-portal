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
  combined: boolean
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
function durationBucket(seconds: number | null) {
  if (seconds == null) return 'unknown'
  if (seconds < 30 * 60) return 'short'
  if (seconds <= 60 * 60) return 'medium'
  return 'long'
}
function isMeditationRecording(code: string, name: string) {
  const normalized = `${code} ${name}`.toLowerCase()
  return normalized.includes('meditation') || /^m\d*\b/.test(normalized)
}

const archiveVersions: MeditationVersion[] = allArchiveSessions()
  .filter((item) => isMeditationRecording(item.code, item.name))
  .map((item) => {
    const course = courseByNumber.get(item.courseNumber)
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
      href: `/courses/${course?.slug ?? `course-${item.courseNumber}`}/${item.offeringSlug}#recording-${item.videoId}`,
      combined: item.name.toLowerCase().includes('class') && item.name.toLowerCase().includes('meditation'),
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
    combined: false,
  }))

const versions = [...archiveVersions, ...course8Versions]

export default async function MeditationsPage({ searchParams }: { searchParams: Promise<{ course?: string; duration?: string }> }) {
  const params = await searchParams
  const courseFilter = Number(params.course || 0)
  const durationFilter = params.duration || 'all'
  const filtered = versions.filter((item) =>
    (!courseFilter || item.courseNumber === courseFilter)
    && (durationFilter === 'all' || durationBucket(item.durationSeconds) === durationFilter)
  )
  const courseOptions = Array.from(new Map(versions.map((item) => [item.courseNumber, item.sourceLabel] as const))).sort((a, b) => a[0] - b[0])

  return (
    <main className="container page meditation-library-simple">
      <div className="eyebrow">Practice library</div>
      <h1>Meditations</h1>
      <p className="lead">Meditation recordings already identified inside reviewed Course Offerings, collected here without removing their original course context.</p>

      <section className="section">
        <div className="card cream">
          <div className="eyebrow">Source-linked practice index</div>
          <h2>{versions.length} meditation recording{versions.length === 1 ? '' : 's'} currently identified</h2>
          <p>These are teaching versions from the migrated course archives. They are not yet grouped into canonical practices such as one meditation appearing across multiple courses.</p>
          <p className="meta">Canonical names, topics, dedicated audio files, and cross-course grouping will be added only after that meditation source data is reviewed.</p>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><div className="eyebrow">Find a recording</div><h2>Source-linked meditations</h2></div></div>
        <form action="/meditations" method="get" className="advanced-search-form" style={{ marginBottom: 20 }}>
          <label>Source course<select name="course" defaultValue={courseFilter || ''}><option value="">All courses</option>{courseOptions.map(([number, label]) => <option key={number} value={number}>{label}</option>)}</select></label>
          <label>Duration<select name="duration" defaultValue={durationFilter}><option value="all">All durations</option><option value="short">Under 30 min</option><option value="medium">30–60 min</option><option value="long">60+ min</option></select></label>
          <div className="actions"><button className="button sage" type="submit">Apply filters</button>{courseFilter || durationFilter !== 'all' ? <Link className="button" href="/meditations">Clear filters</Link> : null}</div>
        </form>

        {filtered.length ? <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((item) => <div className="program-session-row" key={item.id}>
            <div className="program-session-code">◎</div>
            <div className="program-session-copy">
              <strong>{item.sessionLabel}</strong>
              <div className="meta">{item.sourceLabel} · {item.offeringLabel}</div>
              <div className="meta">{[item.teacher, item.date, item.duration].filter(Boolean).join(' · ')}</div>
            </div>
            <div>{item.combined ? <span className="pill">Combined class + meditation</span> : <span className="pill">Meditation</span>}</div>
            <Link className="button" href={item.href}>Open source</Link>
          </div>)}
        </div> : <div className="card"><p className="meta">No source-linked meditation recordings match these filters.</p></div>}
      </section>
    </main>
  )
}
