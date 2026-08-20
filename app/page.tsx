import Link from 'next/link'
import NextSessionCard from '@/components/next-session-card'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sessions')
    .select(`
      id, code, title, starts_at, ends_at, zoom_url,
      courses!inner(title),
      course_offerings(label),
      session_teachers(teachers(full_name))
    `)
    .eq('status', 'published')
    .not('starts_at', 'is', null)
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
      <section className="hero">
        <div className="container">
          <div className="eyebrow">Study · Practice · Return</div>
          <h1>Classics Courses with Timothy Lowenhaupt</h1>
          <p className="lead">
            A public study library for Classics Courses, Living Lam Rim, meditations, recordings,
            transcripts, and Study Notes. Sign in only when you want to save your own progress and notes.
          </p>
        </div>
      </section>

      <section className="container section">
        <NextSessionCard sessions={sessions} />
      </section>

      <section className="container section">
        <div className="grid">
          <Link className="card" href="/courses">
            <div className="pill">18-course path</div>
            <h3 style={{ marginTop: 18 }}>Classics Courses</h3>
            <p className="meta">Browse the canonical 18 courses and their Course Offerings.</p>
          </Link>
          <Link className="card sage" href="/living-lam-rim">
            <div className="pill">Ongoing program</div>
            <h3 style={{ marginTop: 18 }}>Living Lam Rim</h3>
            <p className="meta">Browse by term, then open the individual class you want to study.</p>
          </Link>
          <Link className="card" href="/meditations">
            <div className="pill">Practice library</div>
            <h3 style={{ marginTop: 18 }}>Meditations</h3>
            <p className="meta">Find meditations by name, duration, teacher, topic, and source course.</p>
          </Link>
        </div>
      </section>

      <section className="container section">
        <div className="card">
          <div className="eyebrow">Personal study layer</div>
          <h2>Keep your progress without putting the library behind a login.</h2>
          <p className="lead" style={{ fontSize: 18 }}>
            Anyone can browse. A Google account is only needed for private notes, bookmarks, course progress,
            and your My Learning dashboard.
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
