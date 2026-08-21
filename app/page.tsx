import Link from 'next/link'
import NextSessionCard from '@/components/next-session-card'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const recentHorizon = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('sessions')
    .select(`
      id, code, title, starts_at, ends_at, zoom_url,
      courses!inner(title, status),
      course_offerings!inner(label, status),
      session_teachers(teachers(full_name))
    `)
    .eq('status', 'published')
    .eq('courses.status', 'published')
    .eq('course_offerings.status', 'published')
    .not('starts_at', 'is', null)
    .gte('starts_at', recentHorizon)
    .order('starts_at', { ascending: true })
    .limit(40)

  const sessions = (data ?? []).map((row: any) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    zoom_url: row.zoom_url,
    course_title: row.courses?.title ?? 'Classics Course',
    offering_label: row.course_offerings?.label ?? null,
    teacher_names: (row.session_teachers ?? [])
      .map((item: any) => item.teachers?.full_name)
      .filter(Boolean),
  }))

  return (
    <main>
      <section className="hero home-hero">
        <div className="container">
          <div className="eyebrow">Study · Practice · Return</div>
          <h1>Classics Courses with Timothy Lowenhaupt</h1>
          <p className="lead">
            Recordings, Study Notes, Reference Transcripts, meditations, and course materials in one calm study space.
            The library stays public. Sign in only when you want to save your own notes, bookmarks, and progress.
          </p>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Current teaching</div>
            <h2>Next</h2>
          </div>
          <p>Your local timezone is used automatically.</p>
        </div>
        <NextSessionCard sessions={sessions} />
      </section>

      <section className="container section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Explore</div>
            <h2>Choose where to study</h2>
          </div>
        </div>
        <div className="grid two">
          <Link className="card home-library-card cream" href="/courses">
            <div className="eyebrow">18 courses</div>
            <h3>Classics Courses</h3>
            <p className="meta">Browse the canonical 18-course curriculum and choose the Course Offering you want to study.</p>
            <div className="go">Browse all 18 →</div>
          </Link>
          <Link className="card home-library-card sage" href="/living-lam-rim">
            <div className="eyebrow">Living course</div>
            <h3>Living Lam Rim</h3>
            <p className="meta">Move term by term through meditation and insight teachings, with each class kept as its own study page.</p>
            <div className="go">Open terms →</div>
          </Link>
          <Link className="card home-library-card" href="/other-programs">
            <div className="eyebrow">More teachings</div>
            <h3>Other Programs</h3>
            <p className="meta">Explore text studies and teaching programs that sit outside the 18 Classics Courses.</p>
            <div className="go">Explore programs →</div>
          </Link>
          <Link className="card home-library-card" href="/meditations">
            <div className="eyebrow">Practice library</div>
            <h3>Meditations</h3>
            <p className="meta">Find a practice by name, duration, teacher, topic, or source teaching.</p>
            <div className="go">Find a meditation →</div>
          </Link>
        </div>
      </section>

      <section className="container section">
        <div className="card study-layer-card">
          <div className="eyebrow">Personal study layer</div>
          <h2>Keep the public library open. Save only what is yours.</h2>
          <p className="lead">
            A Google account is only needed for private notes, bookmarks, flashcard progress, course progress, and My Learning.
          </p>
          <div className="actions">
            <Link className="button red" href="/login">Continue with Google</Link>
            <Link className="button" href="/courses/classics-course-8/taiwan-2026">Open Course 8 Taiwan</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
