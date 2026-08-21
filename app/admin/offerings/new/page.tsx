import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createOffering } from './actions'

export const dynamic = 'force-dynamic'

export default async function NewOfferingPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  if (!userId) {
    return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') {
    return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>
  }

  const { data: courses } = await supabase
    .from('courses')
    .select('id, kind, canonical_number, title, status, sort_order')
    .neq('status', 'archived')
    .order('sort_order')

  return (
    <main className="container page">
      <div className="eyebrow">Admin · New Course Offering</div>
      <h1>Create a Course Offering</h1>
      <p className="lead">Create the teaching container first. Add classes, meditations, teachers, recordings, Study Notes, transcripts, and materials after it is created.</p>

      <section className="section card sage">
        <div className="eyebrow">Safe default</div>
        <h2 style={{ fontSize: 30 }}>Start as Draft</h2>
        <p className="meta">Draft Course Offerings stay out of the public library while the schedule and content are being prepared.</p>
      </section>

      <section className="section card">
        <form className="form-stack" action={createOffering}>
          <label>Course
            <select className="input" name="course_id" required defaultValue="">
              <option value="" disabled>Choose course or program</option>
              {(courses ?? []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.canonical_number ? `Classics Course ${course.canonical_number} · ` : ''}{course.title}
                </option>
              ))}
            </select>
          </label>

          <div className="grid two">
            <label>Student-facing label
              <input className="input" name="label" placeholder="Taiwan · 2026" required />
            </label>
            <label>URL slug
              <input className="input" name="slug" placeholder="Optional, e.g. taiwan-2026" />
            </label>
            <label>Location
              <input className="input" name="location" placeholder="Taiwan, Arizona, Online" />
            </label>
            <label>Year
              <input className="input" name="year" type="number" min="1900" max="2200" placeholder="2026" />
            </label>
            <label>Starts on
              <input className="input" name="starts_on" type="date" />
            </label>
            <label>Ends on
              <input className="input" name="ends_on" type="date" />
            </label>
          </div>

          <label>Languages
            <input className="input" name="language_codes" placeholder="en, zh" />
          </label>
          <label>Description
            <textarea className="input" name="description" rows={5} placeholder="Optional description for students" />
          </label>
          <label>Artwork URL
            <input className="input" name="artwork_url" type="url" placeholder="Optional" />
          </label>
          <label>Telegram URL
            <input className="input" name="telegram_url" type="url" placeholder="Optional" />
          </label>
          <label>Status
            <select className="input" name="status" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <div className="actions">
            <button className="button red" type="submit">Create Course Offering</button>
            <Link className="button" href="/admin">Cancel</Link>
          </div>
        </form>
      </section>
    </main>
  )
}
