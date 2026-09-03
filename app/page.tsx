import Link from 'next/link'
import rawCourseData from '@/content/classics/course-08/taiwan-2026.json'

type CourseSession = {
  id: string
  slug: string
  label: string
  kind: string
  teacher: string
  transcriptSource?: string | null
  studyNotesSource?: string | null
}

type CourseData = {
  course: {
    canonicalNumber: number
    title: string
    fullTitle: string
  }
  offering: {
    label: string
    location: string
    startsOn: string
    endsOn: string
    languages: string[]
    teachers: string[]
  }
  sessions: CourseSession[]
}

const courseData = rawCourseData as CourseData

function archiveDateRange(startsOn: string, endsOn: string) {
  const start = new Date(`${startsOn}T12:00:00Z`)
  const end = new Date(`${endsOn}T12:00:00Z`)
  const month = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(start)
  return `${month} ${start.getUTCDate()}–${end.getUTCDate()}, ${end.getUTCFullYear()}`
}

export default function HomePage() {
  const { course, offering, sessions } = courseData
  const transcriptCount = sessions.filter((session) => Boolean(session.transcriptSource)).length
  const studyNotesCount = sessions.filter((session) => Boolean(session.studyNotesSource)).length
  const archiveHref = '/courses/course-8/taiwan-2026'

  return (
    <main>
      <section className="hero home-v12-hero">
        <div className="container">
          <div className="eyebrow">Teaching library</div>
          <h1>Study the teachings.</h1>
          <p>Browse Classics Courses, recordings, Study Notes, Reference Transcripts, meditations, and course materials in one calm study space.</p>
          <div className="actions" style={{ marginTop: 22 }}>
            <Link className="button sage" href="/courses">Browse Classics Courses</Link>
            <Link className="button" href="/search">Search the Library</Link>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Latest teaching archive</div>
            <h2>Classics Course {course.canonicalNumber} · {offering.label}</h2>
            <p>The first Course Offering being migrated into the GitHub-backed Library.</p>
          </div>
        </div>

        <div className="home-current-grid">
          <Link className="home-active-course" href={archiveHref}>
            <div className="home-active-artwork placeholder" aria-hidden="true" />
            <div className="home-active-copy">
              <div className="eyebrow">Classics Course {course.canonicalNumber}</div>
              <h2>{course.title}</h2>
              <p>{offering.teachers.join(' and ')} · {archiveDateRange(offering.startsOn, offering.endsOn)} · {offering.location}</p>
              <div className="offering-meta" style={{ marginTop: 14 }}>
                <span className="pill">{sessions.length} sessions</span>
                <span className="pill">{transcriptCount} transcripts</span>
                <span className="pill">{studyNotesCount} Study Notes</span>
                <span className="pill">{offering.languages.join(' · ')}</span>
              </div>
              <span className="button sage home-active-button">Open Course 8</span>
            </div>
          </Link>

          <div className="card">
            <div className="eyebrow">Search the archive</div>
            <h2>Find the exact passage.</h2>
            <p className="meta">Search across the Course 8 transcripts and available Study Notes. Transcript results open directly at the matching paragraph.</p>
            <div className="actions" style={{ marginTop: 18 }}>
              <Link className="button sage" href="/search">Search teachings</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head"><div><h2>Explore</h2></div></div>
        <div className="home-explore-grid">
          <Link className="card home-library-card" href="/courses">
            <div className="eyebrow">18 courses</div>
            <h3>Classics Courses</h3>
            <p className="meta">The full Classics curriculum, with teaching archives added course by course.</p>
            <div className="go">Browse all 18 →</div>
          </Link>
          <Link className="card home-library-card" href="/living-lam-rim">
            <div className="eyebrow">Steps on the Path Course</div>
            <h3>Living Lam Rim</h3>
            <p className="meta">Move term by term through meditation and insight teachings, with each class kept as its own study page.</p>
            <div className="go">Open terms →</div>
          </Link>
          <Link className="card home-library-card" href="/perfection-of-wisdom">
            <div className="eyebrow">Diamond Cutter Classics series</div>
            <h3>Perfection of Wisdom</h3>
            <p className="meta">Study the long-running text and commentary project through its teaching seasons and individual sessions.</p>
            <div className="go">Continue study →</div>
          </Link>
          <Link className="card home-library-card" href="/meditations">
            <div className="eyebrow">Practice library</div>
            <h3>Meditations</h3>
            <p className="meta">Find a practice by time first, then refine by topic, teacher, or source when needed.</p>
            <div className="go">Find a meditation →</div>
          </Link>
        </div>
        <div className="home-other-teachings">
          <Link href="/other-programs">Other teachings and study projects <span aria-hidden="true">→</span></Link>
          <p>For individual classes, smaller study projects, and teachings that do not need to become a main Course Offering.</p>
        </div>
      </section>
    </main>
  )
}
