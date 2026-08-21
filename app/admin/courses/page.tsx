import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createProgram, updateCourse } from './actions'

export const dynamic = 'force-dynamic'

function typeLabel(kind: string) {
  if (kind === 'classics') return 'Classics Course'
  if (kind === 'living_lam_rim') return 'Living Lam Rim'
  if (kind === 'book') return 'Text Study'
  return 'Other Program'
}

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams
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
    .select('id, kind, canonical_number, slug, title, subtitle, description, status, sort_order, course_offerings(id, slug, label, status, sort_order)')
    .order('sort_order')

  const notice = saved === 'created' ? 'Program created.' : saved === 'updated' ? 'Course or program updated.' : null

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Courses &amp; Programs</div>
      <h1>Courses and programs</h1>
      <p className="lead">The 18 Classics Courses and Living Lam Rim keep their canonical identity. Additional text studies and programs can be created and managed here without code.</p>

      {notice ? <div className="card completed" style={{ marginTop: 20 }}>{notice}</div> : null}

      <section className="section card sage">
        <div className="eyebrow">New program</div>
        <h2 style={{ fontSize: 30 }}>Create a text study or other program</h2>
        <p className="meta">This creates the program itself. Afterward, create one or more Course Offerings for its actual teachings.</p>
        <form className="form-stack" action={createProgram}>
          <div className="grid two">
            <label>Type
              <select className="input" name="kind" defaultValue="other">
                <option value="other">Other Program</option>
                <option value="book">Text Study</option>
              </select>
            </label>
            <label>Status
              <select className="input" name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <label>Title<input className="input" name="title" required placeholder="Program title" /></label>
          <label>Subtitle<input className="input" name="subtitle" placeholder="Optional" /></label>
          <label>URL slug<input className="input" name="slug" placeholder="Optional" /></label>
          <label>Description<textarea className="input" name="description" rows={5} placeholder="What students should know about this program" /></label>
          <div className="actions"><button className="button red" type="submit">Create program</button></div>
        </form>
      </section>

      <section className="section">
        <div className="eyebrow">Catalog</div>
        <h2 style={{ fontSize: 32 }}>Existing courses and programs</h2>

        {(courses ?? []).map((course: any) => {
          const identityProtected = course.kind === 'classics' || course.kind === 'living_lam_rim'
          const offerings = (course.course_offerings ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          return (
            <div className="card" key={course.id} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div className="eyebrow">{typeLabel(course.kind)}{course.canonical_number ? ` ${course.canonical_number}` : ''}</div>
                  <h3 style={{ fontSize: 27 }}>{course.title}</h3>
                  <div className="meta">{course.status} · {offerings.length} Course Offering{offerings.length === 1 ? '' : 's'}</div>
                </div>
                <div className="actions" style={{ marginTop: 0 }}>
                  <Link className="button sage" href={`/admin/offerings/new?course=${course.id}`}>Add Course Offering</Link>
                </div>
              </div>

              <form className="form-stack" action={updateCourse.bind(null, course.id)} style={{ marginTop: 20 }}>
                {identityProtected ? (
                  <div className="note">
                    <strong>Canonical identity protected</strong>
                    <div className="meta">The course title, number, type, and URL slug are kept stable. You can still edit its subtitle, description, and visibility.</div>
                  </div>
                ) : (
                  <>
                    <div className="grid two">
                      <label>Type
                        <select className="input" name="kind" defaultValue={course.kind}>
                          <option value="other">Other Program</option>
                          <option value="book">Text Study</option>
                        </select>
                      </label>
                      <label>URL slug<input className="input" name="slug" defaultValue={course.slug} /></label>
                    </div>
                    <label>Title<input className="input" name="title" defaultValue={course.title} required /></label>
                  </>
                )}

                <label>Subtitle<input className="input" name="subtitle" defaultValue={course.subtitle ?? ''} /></label>
                <label>Description<textarea className="input" name="description" rows={5} defaultValue={course.description ?? ''} /></label>
                <label>Status
                  <select className="input" name="status" defaultValue={course.status}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <div className="actions"><button className="button" type="submit">Save course</button></div>
              </form>

              {offerings.length ? (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                  <strong>Course Offerings</strong>
                  {offerings.map((offering: any) => (
                    <div key={offering.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', padding: '10px 0' }}>
                      <div><span className="meta">{offering.label} · {offering.status}</span></div>
                      <Link className="button" href={`/admin/offerings/${offering.id}`}>Manage</Link>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </section>

      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
