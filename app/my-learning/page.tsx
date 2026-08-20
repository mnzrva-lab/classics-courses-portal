import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function MyLearningPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  if (!userId) redirect('/login')

  const [{ data: progress }, { data: notes }, { data: courseBookmarks }] = await Promise.all([
    supabase.from('user_session_progress').select('session_id, completed_at, last_opened_at').order('last_opened_at', { ascending: false }).limit(500),
    supabase.from('student_notes').select('id, note, updated_at, session_id').order('updated_at', { ascending: false }).limit(5),
    supabase.from('user_course_bookmarks').select('course_id, courses(title, canonical_number)').order('created_at', { ascending: false }).limit(6),
  ])

  const completedSessionIds = (progress ?? [])
    .filter((item: any) => item.completed_at)
    .map((item: any) => item.session_id)

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

      <section className="grid section">
        <div className="card sage">
          <div className="meta">Path of Classics Master</div>
          <div className="stat">{classicsCompleted} / 18</div>
          <div className="meta">canonical Classics Courses completed</div>
        </div>
        <div className="card">
          <div className="meta">Sessions completed</div>
          <div className="stat">{completedSessionIds.length}</div>
          <div className="meta">Completed classes and practices can always be revisited.</div>
        </div>
        <div className="card">
          <div className="meta">Course teachings completed</div>
          <div className="stat">{completedOfferings}</div>
          <div className="meta">Repeat Course Offerings do not increase the 18-course total twice.</div>
        </div>
      </section>

      <section className="grid two section">
        <div className="card">
          <div className="eyebrow">Bookmarked Courses</div>
          <h2 style={{ fontSize: 30 }}>Return to what matters</h2>
          {(courseBookmarks ?? []).length ? (
            <div className="list">
              {(courseBookmarks ?? []).map((item: any) => (
                <div className="row" key={item.course_id}>
                  <div className="session-code">{item.courses?.canonical_number ? `C${item.courses.canonical_number}` : '•'}</div>
                  <div><strong>{item.courses?.title ?? 'Course'}</strong></div>
                  <span className="meta">Bookmarked</span>
                </div>
              ))}
            </div>
          ) : <p className="meta">Bookmarked courses will appear here.</p>}
        </div>

        <div className="card">
          <div className="eyebrow">Recent Notes</div>
          <h2 style={{ fontSize: 30 }}>Your study notes</h2>
          {(notes ?? []).length ? (
            <div className="list">
              {(notes ?? []).map((item: any) => (
                <div key={item.id} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                  <div>{item.note}</div>
                  <div className="meta">{new Date(item.updated_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          ) : <p className="meta">Private notes you save from class pages will appear here.</p>}
        </div>
      </section>

      <section className="section card">
        <div className="eyebrow">Account</div>
        <h3>Privacy & Data</h3>
        <p className="meta">Notes, bookmarks, progress, and account settings are protected by your signed-in user ID.</p>
        <div className="actions">
          <Link className="button" href="/courses">Browse courses</Link>
          <form action="/auth/signout" method="post"><button className="button" type="submit">Sign out</button></form>
        </div>
      </section>
    </main>
  )
}
