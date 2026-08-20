import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { clearAllBookmarks, clearSearchHistory, deleteAllNotes, resetAllProgress, resetCourseProgress, updatePrivacySettings } from './actions'

export const dynamic = 'force-dynamic'

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ saved?: string; course?: string }> }) {
  const { saved } = await searchParams
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const [{ data: settings }, { count: noteCount }, { count: courseBookmarkCount }, { count: sessionBookmarkCount }, { count: paragraphBookmarkCount }, { data: progressRows }, { count: searchCount }] = await Promise.all([
    supabase.from('user_settings').select('save_notes, save_bookmarks, save_progress, save_search_history, track_classics_master, timezone').eq('user_id', userId).maybeSingle(),
    supabase.from('student_notes').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_course_bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_session_bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_paragraph_bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('user_session_progress').select('session_id, completed_at, sessions(course_id, courses(title, canonical_number))').eq('user_id', userId),
    supabase.from('user_search_history').select('*', { count: 'exact', head: true }).eq('user_id', userId),
  ])

  const progress = progressRows ?? []
  const bookmarkCount = (courseBookmarkCount ?? 0) + (sessionBookmarkCount ?? 0) + (paragraphBookmarkCount ?? 0)
  const progressByCourse = new Map<string, { id: string; title: string; canonicalNumber: number | null; records: number; completed: number }>()

  for (const item of progress as any[]) {
    const session = item.sessions
    const courseId = session?.course_id
    if (!courseId) continue
    const course = session?.courses
    if (!progressByCourse.has(courseId)) {
      progressByCourse.set(courseId, {
        id: courseId,
        title: course?.title ?? 'Course',
        canonicalNumber: course?.canonical_number ?? null,
        records: 0,
        completed: 0,
      })
    }
    const group = progressByCourse.get(courseId)!
    group.records += 1
    if (item.completed_at) group.completed += 1
  }

  const progressCourses = Array.from(progressByCourse.values()).sort((a, b) => {
    const aNumber = a.canonicalNumber ?? 9999
    const bNumber = b.canonicalNumber ?? 9999
    return aNumber - bNumber || a.title.localeCompare(b.title)
  })

  const message = saved === 'settings'
    ? 'Privacy settings saved.'
    : saved === 'search-history'
      ? 'Search history cleared.'
      : saved === 'notes-deleted'
        ? 'All private notes deleted.'
        : saved === 'bookmarks-cleared'
          ? 'All bookmarks cleared.'
          : saved === 'course-reset'
            ? 'Progress for that course was reset.'
            : saved === 'progress-reset'
              ? 'Study progress reset.'
              : null

  return (
    <main className="container page">
      <div className="eyebrow">Account</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>Privacy &amp; Data</h1>
      <p className="lead">Choose what this study account remembers. Your settings and private study data are tied to your signed-in account.</p>

      {message ? <div className="card completed section">{message}</div> : null}

      <section className="section card">
        <div className="eyebrow">Saving preferences</div>
        <h2 style={{ fontSize: 32 }}>What should the portal remember?</h2>
        <p className="meta">Turning a setting off stops new saves for that category. It does not erase information you already saved.</p>
        <form className="form-stack" action={updatePrivacySettings}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" name="save_notes" defaultChecked={settings?.save_notes ?? true} />
            <span><strong>Save notes</strong><br /><span className="meta">Allow private study notes to be stored in your account.</span></span>
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" name="save_bookmarks" defaultChecked={settings?.save_bookmarks ?? true} />
            <span><strong>Save bookmarks</strong><br /><span className="meta">Allow course, class, and transcript passage bookmarks.</span></span>
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" name="save_progress" defaultChecked={settings?.save_progress ?? true} />
            <span><strong>Save progress</strong><br /><span className="meta">Remember started and completed sessions.</span></span>
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" name="save_search_history" defaultChecked={settings?.save_search_history ?? false} />
            <span><strong>Save search history</strong><br /><span className="meta">Off by default. When enabled, searches can be saved to your account.</span></span>
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input type="checkbox" name="track_classics_master" defaultChecked={settings?.track_classics_master ?? false} />
            <span><strong>Track Path of Classics Master</strong><br /><span className="meta">Show canonical Classics Course completion across the 18-course path.</span></span>
          </label>
          <label>Preferred timezone
            <input className="input" name="timezone" defaultValue={settings?.timezone ?? ''} placeholder="Optional, e.g. Europe/Prague" />
          </label>
          <div className="actions"><button className="button red" type="submit">Save settings</button></div>
        </form>
      </section>

      <section className="grid two section">
        <div className="card">
          <div className="eyebrow">Exports</div>
          <h2 style={{ fontSize: 30 }}>Keep your own copy</h2>
          <p className="meta">Export your private notes and bookmarks as Markdown files. Additional formats can be added later without changing your stored data.</p>
          <div className="actions">
            <a className="button" href="/account/export/notes">Export notes</a>
            <a className="button" href="/account/export/bookmarks">Export bookmarks</a>
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">Stored now</div>
          <h2 style={{ fontSize: 30 }}>Your study data</h2>
          <div className="list">
            <div className="row"><strong>Notes</strong><span className="meta">{noteCount ?? 0}</span></div>
            <div className="row"><strong>Bookmarks</strong><span className="meta">{bookmarkCount}</span></div>
            <div className="row"><strong>Progress records</strong><span className="meta">{progress.length}</span></div>
            <div className="row"><strong>Saved searches</strong><span className="meta">{searchCount ?? 0}</span></div>
          </div>
        </div>
      </section>

      {progressCourses.length ? (
        <section className="section card">
          <div className="eyebrow">Course progress</div>
          <h2 style={{ fontSize: 32 }}>Reset one course</h2>
          <p className="meta">This removes started/completed markers for every Course Offering and session under the selected course. Notes and bookmarks are not changed.</p>
          {progressCourses.map((course) => (
            <div key={course.id} style={{ padding: '18px 0', borderTop: '1px solid var(--line)' }}>
              <strong>{course.canonicalNumber ? `Course ${course.canonicalNumber} · ` : ''}{course.title}</strong>
              <div className="meta">{course.completed} completed · {course.records} progress record{course.records === 1 ? '' : 's'}</div>
              <form className="form-stack" action={resetCourseProgress.bind(null, course.id)} style={{ marginTop: 12 }}>
                <p className="meta">Type <strong>RESET COURSE</strong> to confirm.</p>
                <input className="input" name="confirmation" autoComplete="off" />
                <div className="actions"><button className="button" type="submit">Reset this course</button></div>
              </form>
            </div>
          ))}
        </section>
      ) : null}

      <section className="section card">
        <div className="eyebrow">Clear data</div>
        <h2 style={{ fontSize: 32 }}>Remove saved study data</h2>
        <p className="meta">These actions affect only your account. They do not change course content or other students.</p>

        <div style={{ padding: '18px 0', borderTop: '1px solid var(--line)' }}>
          <h3>Clear search history</h3>
          <form action={clearSearchHistory}><button className="button" type="submit">Clear search history</button></form>
        </div>

        <div style={{ padding: '18px 0', borderTop: '1px solid var(--line)' }}>
          <h3>Delete all notes</h3>
          <p className="meta">Type <strong>DELETE NOTES</strong> to confirm.</p>
          <form className="form-stack" action={deleteAllNotes}>
            <input className="input" name="confirmation" autoComplete="off" />
            <div className="actions"><button className="button" type="submit">Delete all notes</button></div>
          </form>
        </div>

        <div style={{ padding: '18px 0', borderTop: '1px solid var(--line)' }}>
          <h3>Clear all bookmarks</h3>
          <p className="meta">Type <strong>CLEAR BOOKMARKS</strong> to confirm.</p>
          <form className="form-stack" action={clearAllBookmarks}>
            <input className="input" name="confirmation" autoComplete="off" />
            <div className="actions"><button className="button" type="submit">Clear bookmarks</button></div>
          </form>
        </div>

        <div style={{ padding: '18px 0', borderTop: '1px solid var(--line)' }}>
          <h3>Reset all progress</h3>
          <p className="meta">Type <strong>RESET PROGRESS</strong> to confirm.</p>
          <form className="form-stack" action={resetAllProgress}>
            <input className="input" name="confirmation" autoComplete="off" />
            <div className="actions"><button className="button" type="submit">Reset progress</button></div>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="actions">
          <Link className="button" href="/my-learning">← My Learning</Link>
          <form action="/auth/signout" method="post"><button className="button" type="submit">Sign out</button></form>
        </div>
      </section>
    </main>
  )
}
