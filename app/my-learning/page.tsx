import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function sessionPath(session: any) {
  const course = session?.courses
  const offering = session?.course_offerings
  if (!course?.slug || !offering?.slug || !session?.slug) return null
  return `/courses/${course.slug}/${offering.slug}/${session.slug}`
}

export default async function MyLearningPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  if (!userId) redirect('/login')

  const [{ data: progressRows }, { data: noteRows }, { data: courseBookmarkRows }] = await Promise.all([
    supabase
      .from('user_session_progress')
      .select(`
        session_id, completed_at, last_opened_at,
        sessions(id, slug, code, title, session_type, offering_id, courses(kind, slug, title, canonical_number), course_offerings(slug, label))
      `)
      .eq('user_id', userId)
      .order('last_opened_at', { ascending: false })
      .limit(500),
    supabase
      .from('student_notes')
      .select('id, note, updated_at, sessions(id, slug, code, title, courses(slug, title, canonical_number), course_offerings(slug, label))')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('user_course_bookmarks')
      .select('course_id, created_at, courses(slug, title, canonical_number, course_offerings(slug, label, status, sort_order))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const progress = progressRows ?? []
  const notes = noteRows ?? []
  const courseBookmarks = courseBookmarkRows ?? []

  const completedSessionIds = progress
    .filter((item: any) => item.completed_at)
    .map((item: any) => item.session_id)

  const meditationsPracticed = progress.filter((item: any) => item.completed_at && item.sessions?.session_type === 'meditation').length
  const continueLearning = progress.filter((item: any) => !item.completed_at && item.sessions).slice(0, 5)

  let classicsCompleted = 0
  let completedOfferings = 0

  if (completedSessionIds.length > 0) {
    const { data: completedSessions } = await supabase
      .from('sessions')
      .select('id, offering_id, required_for_completion, courses(kind, canonical_number)')
      .in('id', completedSessionIds)

    const offeringIds = Array.from(new Set(
      (completedSessions ?? [])
        .map((item: any) => item.offering_id)
        .filter(Boolean)
    )) as string[]

    if (offeringIds.length > 0) {
      const { data: requiredSessions } = await supabase
        .from('sessions')
        .select('id, offering_id, courses(kind, canonical_number)')
        .in('offering_id', offeringIds)
        .eq('required_for_completion', true)
        .eq('status', 'published')

      const requiredByOffering = new Map<string, Set<string>>()
      const courseNumberByOffering = new Map<string, number>()

      for (const item of requiredSessions ?? []) {
        if (!item.offering_id) continue
        if (!requiredByOffering.has(item.offering_id)) requiredByOffering.set(item.offering_id, new Set())
        requiredByOffering.get(item.offering_id)!.add(item.id)

        const course = item.courses as any
        if (course?.kind === 'classics' && course?.canonical_number) {
          courseNumberByOffering.set(item.offering_id, course.canonical_number)
        }
      }

      const completedSet = new Set(completedSessionIds)
      const completedCourseNumbers = new Set<number>()

      for (const [offeringId, requiredIds] of requiredByOffering.entries()) {
        if (requiredIds.size > 0 && Array.from(requiredIds).every((id) => completedSet.has(id))) {
          completedOfferings += 1
          const canonicalNumber = courseNumberByOffering.get(offeringId)
          if (canonicalNumber) completedCourseNumbers.add(canonicalNumber)
        }
      }

      classicsCompleted = completedCourseNumbers.size
    }
  }

  return (
    <main className="container page">
      <div className="eyebrow">Your private study space</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>My Learning</h1>
      <p className="lead">Continue what you started, return to saved courses, and see your progress without turning study into a points system.</p>

      <section className="grid section">
        <div className="card sage">
          <div className="meta">Path of Classics Master</div>
          <div className="stat">{classicsCompleted} / 18</div>
          <div className="meta">canonical Classics Courses completed</div>
        </div>
        <div className="card">
          <div className="meta">Teaching sessions completed</div>
          <div className="stat">{completedSessionIds.length}</div>
          <div className="meta">Classes, practices, reviews, and other sessions.</div>
        </div>
        <div className="card">
          <div className="meta">Meditations practiced</div>
          <div className="stat">{meditationsPracticed}</div>
          <div className="meta">Completed sessions marked as meditation.</div>
        </div>
        <div className="card">
          <div className="meta">Course teachings completed</div>
          <div className="stat">{completedOfferings}</div>
          <div className="meta">Repeat Course Offerings do not increase the 18-course total twice.</div>
        </div>
      </section>

      <section className="section card">
        <div className="eyebrow">Continue Learning</div>
        <h2 style={{ fontSize: 32 }}>Pick up where you left off</h2>
        {continueLearning.length ? (
          <div className="list">
            {continueLearning.map((item: any) => {
              const session = item.sessions
              const href = sessionPath(session)
              return (
                <div key={item.session_id} className="row">
                  <div className="session-code">{session?.code || '•'}</div>
                  <div>
                    <strong>{session?.title ?? 'Session'}</strong>
                    <div className="meta">{session?.courses?.title ?? ''}{session?.course_offerings?.label ? ` · ${session.course_offerings.label}` : ''}</div>
                  </div>
                  {href ? <Link className="button" href={href}>Continue</Link> : null}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="meta">Open a class and choose “Start studying.” It will appear here until you mark it complete.</p>
        )}
      </section>

      <section className="grid two section">
        <div className="card">
          <div className="eyebrow">Bookmarked Courses</div>
          <h2 style={{ fontSize: 30 }}>Return to what matters</h2>
          {courseBookmarks.length ? (
            <div className="list">
              {courseBookmarks.map((item: any) => {
                const course = item.courses
                const offerings = (course?.course_offerings ?? [])
                  .filter((offering: any) => offering.status === 'published')
                  .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                const offering = offerings[0]
                const href = course?.slug && offering?.slug ? `/courses/${course.slug}/${offering.slug}` : null
                return (
                  <div className="row" key={item.course_id}>
                    <div className="session-code">{course?.canonical_number ? `C${course.canonical_number}` : '•'}</div>
                    <div>
                      <strong>{course?.title ?? 'Course'}</strong>
                      {offering?.label ? <div className="meta">{offering.label}</div> : null}
                    </div>
                    {href ? <Link className="button" href={href}>Open</Link> : <span className="meta">Bookmarked</span>}
                  </div>
                )
              })}
            </div>
          ) : <p className="meta">Bookmarked courses will appear here.</p>}
        </div>

        <div className="card">
          <div className="eyebrow">Recent Notes</div>
          <h2 style={{ fontSize: 30 }}>Your study notes</h2>
          {notes.length ? (
            <div className="list">
              {notes.map((item: any) => {
                const session = item.sessions
                const href = sessionPath(session)
                return (
                  <div key={item.id} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                    <div>{item.note}</div>
                    <div className="meta">{session?.code ? `${session.code} · ` : ''}{session?.title ?? 'Session'} · {new Date(item.updated_at).toLocaleDateString()}</div>
                    {href ? <div className="actions"><Link className="button" href={href}>Open source class</Link></div> : null}
                  </div>
                )
              })}
            </div>
          ) : <p className="meta">Private notes you save from class pages will appear here.</p>}
          <div className="actions"><Link className="button" href="/my-notes">All notes & bookmarks</Link></div>
        </div>
      </section>

      <section className="section card">
        <div className="eyebrow">Account</div>
        <h3>Privacy & Data</h3>
        <p className="meta">Notes, bookmarks, progress, and account settings are protected by your signed-in user ID.</p>
        <div className="actions">
          <Link className="button" href="/courses">Browse courses</Link>
          <Link className="button" href="/meditations">Meditations</Link>
          <form action="/auth/signout" method="post"><button className="button" type="submit">Sign out</button></form>
        </div>
      </section>
    </main>
  )
}
