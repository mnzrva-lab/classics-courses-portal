import Link from 'next/link'
import courseData from '@/content/classics/course-08/taiwan-2026.json'

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

      <section className="section">
        <div className="offering-section-head">
          <div>
            <div className="eyebrow">Course content</div>
            <h2>Classes &amp; meditations</h2>
            <p>This Course Offering is now served from the GitHub Library snapshot and does not require Supabase to load.</p>
          </div>
        </div>

        <div className="module-list">
          {sessions.map((session) => (
            <Link className="module" key={session.id} href={`/courses/course-8/taiwan-2026/${session.slug}`}>
              <div className="module-num">{session.kind === 'Meditation' ? 'M' : 'C'}</div>
              <div>
                <b>{session.label}</b>
                <small>{session.date} · {session.teacher}</small>
              </div>
              <span className="status">Recording</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
