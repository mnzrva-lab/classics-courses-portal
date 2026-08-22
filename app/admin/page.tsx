import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CourseRow = {
  id: string
  kind: string
  canonical_number: number | null
  title: string
  status: string
  course_offerings: Array<{ id: string; status: string }> | null
}

function courseLink(course: CourseRow) {
  const label = course.canonical_number ? `Course ${course.canonical_number}` : course.title
  const count = course.course_offerings?.length ?? 0
  return (
    <Link className="admin-index-link" key={course.id} href={`/admin/courses?course=${encodeURIComponent(course.id)}`}>
      <strong>{label}</strong>
      <span>{count} offering{count === 1 ? '' : 's'}</span>
    </Link>
  )
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  if (!userId) {
    return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') {
    return <main className="container page"><div className="card"><h1>Admin access has not been assigned</h1><p>Your study account is working. Admin access is assigned separately.</p><Link className="button" href="/my-learning">Back to My Learning</Link></div></main>
  }

  const { data: rows } = await supabase
    .from('courses')
    .select('id, kind, canonical_number, title, status, course_offerings(id, status)')
    .neq('status', 'archived')
    .order('sort_order')

  const courses = (rows ?? []) as CourseRow[]
  const classics = courses.filter((course) => course.kind === 'classics').sort((a, b) => (a.canonical_number ?? 999) - (b.canonical_number ?? 999))
  const lamRim = courses.filter((course) => course.kind === 'living_lam_rim')
  const textStudies = courses.filter((course) => course.kind === 'book')
  const otherPrograms = courses.filter((course) => course.kind === 'other')

  return (
    <main className="container page admin-index-page">
      <div className="eyebrow">Admin</div>
      <h1>Teaching content</h1>
      <p className="lead">Open the part of the library you need. Course and session detail stays hidden until you choose it.</p>

      <section className="section admin-index-grid">
        <div className="card admin-index-card admin-index-card-wide">
          <div className="eyebrow">Catalog</div>
          <div className="admin-index-card-head">
            <div><h2>Classics Courses</h2><p className="meta">Canonical Courses 1–18. Open a course to manage its Taiwan, Arizona, or other Course Offerings.</p></div>
            <Link className="button" href="/admin/courses">Manage courses &amp; programs</Link>
          </div>
          <div className="admin-index-links classics">{classics.map(courseLink)}</div>
        </div>

        {lamRim.length ? (
          <div className="card admin-index-card">
            <div className="eyebrow">Steps on the Path Course</div>
            <h2>Living Lam Rim</h2>
            <div className="admin-index-links">{lamRim.map(courseLink)}</div>
          </div>
        ) : null}

        <div className="card admin-index-card">
          <div className="eyebrow">Text studies</div>
          <h2>Perfection of Wisdom &amp; texts</h2>
          <div className="admin-index-links">{textStudies.length ? textStudies.map(courseLink) : <span className="meta">No text studies yet.</span>}</div>
        </div>

        {otherPrograms.length ? (
          <div className="card admin-index-card">
            <div className="eyebrow">Other teaching projects</div>
            <h2>Other programs</h2>
            <div className="admin-index-links">{otherPrograms.map(courseLink)}</div>
          </div>
        ) : null}
      </section>

      <section className="section admin-tool-strip" aria-label="Admin tools">
        <Link className="admin-tool-link red" href="/admin/archive-import">
          <span className="eyebrow">Archives</span><strong>Bulk archive import</strong><small>CSV playlists, sessions, teachers, recordings</small>
        </Link>
        <Link className="admin-tool-link" href="/admin/teachers">
          <span className="eyebrow">People</span><strong>Teachers</strong><small>Names and bios</small>
        </Link>
        <Link className="admin-tool-link" href="/admin/meditations">
          <span className="eyebrow">Practice</span><strong>Meditations</strong><small>Canonical practices and versions</small>
        </Link>
        <Link className="admin-tool-link" href="/admin/tibetan">
          <span className="eyebrow">Study</span><strong>Tibetan glossary</strong><small>Terms and teaching sources</small>
        </Link>
      </section>
    </main>
  )
}
