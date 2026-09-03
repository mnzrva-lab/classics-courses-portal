import Link from 'next/link'
import rawCourseData from '@/content/classics/course-08/taiwan-2026.json'
import rawMaterials from '@/content/classics/course-08/taiwan-2026/materials.json'
import styles from './course-offering.module.css'

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

type CourseMaterial = {
  id: string
  title: string
  kind: string
  format: string
  sourceFileName: string
  sourceStatus: string
  url: string | null
  hostingStatus: string
  note?: string
}

type MaterialsData = { materials: CourseMaterial[] }

const courseData = rawCourseData as CourseData
const materialsData = rawMaterials as MaterialsData

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

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/courses">Classics Courses</Link><span>/</span>
        <span>Course {course.canonicalNumber}</span><span>/</span>
        <span>{offering.label}</span>
      </div>

      <section className="offering-hero no-artwork">
        <div className="offering-hero-copy">
          <div className="eyebrow">Classics Course {course.canonicalNumber} · {offering.label}</div>
          <h1 className="offering-title">{course.title}</h1>
          <p className="lead">with {offering.teachers.join(' and ')}</p>
          <div className="offering-meta">
            <span className="pill">Aug 18-22, 2026</span>
            <span className="pill">{offering.location}</span>
            <span className="pill">{offering.languages.join(' · ')}</span>
          </div>
        </div>
      </section>

      <section className="section" id="materials">
        <div className="offering-section-head">
          <div>
            <div className="eyebrow">Course materials</div>
            <h2>Reading</h2>
            <p>The complete primary Course 8 reading has been recovered from the supplied project materials.</p>
          </div>
        </div>
        <div className="grid two">
          {materialsData.materials.map((material) => (
            <div className="card" key={material.id}>
              <div className="eyebrow">{material.kind} · {material.format}</div>
              <h3>{material.title}</h3>
              <p className="meta">Source: {material.sourceFileName}</p>
              <div className="actions">
                {material.url ? <a className="button sage" href={material.url} target="_blank" rel="noreferrer">Open reading ↗</a> : <span className="pill">Source recovered · link being connected</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="offering-section-head">
          <div>
            <div className="eyebrow">Course content</div>
            <h2>Classes &amp; meditations</h2>
            <p>This Course Offering is served from the GitHub Library snapshot and does not require Supabase to load.</p>
          </div>
        </div>

        <div className={styles.list}>
          {sessions.map((session) => (
            <Link className={styles.module} key={session.id} href={`/courses/course-8/taiwan-2026/${session.slug}`}>
              <div className={styles.num}>{sessionMarker(session)}</div>
              <div className={styles.copy}>
                <b>{session.label}</b>
                <small>{session.date}{session.teacher ? ` · ${session.teacher}` : ''}</small>
              </div>
              <span className={styles.status}>{availability(session)}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
