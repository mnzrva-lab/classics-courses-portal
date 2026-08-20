import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function sessionPath(session: any) {
  const course = session?.courses
  const offering = session?.course_offerings
  if (!course?.slug || !offering?.slug || !session?.slug) return null
  return `/courses/${course.slug}/${offering.slug}/${session.slug}`
}

function clip(text: string, length = 240) {
  return text.length > length ? `${text.slice(0, length).trim()}…` : text
}

export default async function MyNotesPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const [notesResult, sessionBookmarksResult, paragraphBookmarksResult, courseBookmarksResult] = await Promise.all([
    supabase
      .from('student_notes')
      .select('id, note, paragraph_id, updated_at, sessions(id, slug, code, title, courses(slug, title, canonical_number), course_offerings(slug, label))')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('user_session_bookmarks')
      .select('session_id, created_at, sessions(id, slug, code, title, courses(slug, title, canonical_number), course_offerings(slug, label))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_paragraph_bookmarks')
      .select('paragraph_id, created_at, transcript_paragraphs(id, body, speaker, start_seconds, transcripts(session_id, sessions(id, slug, code, title, courses(slug, title, canonical_number), course_offerings(slug, label))))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_course_bookmarks')
      .select('course_id, created_at, courses(slug, title, canonical_number, course_offerings(slug, label, status, sort_order))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  const notes = notesResult.data ?? []
  const sessionBookmarks = sessionBookmarksResult.data ?? []
  const paragraphBookmarks = paragraphBookmarksResult.data ?? []
  const courseBookmarks = courseBookmarksResult.data ?? []

  return (
    <main className="container page">
      <div className="eyebrow">Your private study space</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>My Notes</h1>
      <p className="lead">Notes and bookmarks saved while you study, collected in one place.</p>

      <section className="section card">
        <div className="eyebrow">Private notes</div>
        <h2 style={{ fontSize: 32 }}>Your notes</h2>
        {notes.length ? notes.map((item: any) => {
          const session = item.sessions
          const href = sessionPath(session)
          return (
            <div key={item.id} style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
              <div>{item.note}</div>
              <div className="meta" style={{ marginTop: 8 }}>
                {session?.code ? `${session.code} · ` : ''}{session?.title ?? 'Session'} · {new Date(item.updated_at).toLocaleDateString()}
              </div>
              {href ? <div className="actions"><Link className="button" href={href}>Open source class</Link></div> : null}
            </div>
          )
        }) : <p className="meta">Notes you save from class pages will appear here.</p>}
      </section>

      <section className="grid two section">
        <div className="card">
          <div className="eyebrow">Class bookmarks</div>
          <h2 style={{ fontSize: 30 }}>Saved classes</h2>
          {sessionBookmarks.length ? sessionBookmarks.map((item: any) => {
            const session = item.sessions
            const href = sessionPath(session)
            return (
              <div key={item.session_id} style={{ padding: '14px 0', borderTop: '1px solid var(--line)' }}>
                <strong>{session?.code ? `${session.code} · ` : ''}{session?.title ?? 'Session'}</strong>
                <div className="meta">{session?.course_offerings?.label ?? ''}</div>
                {href ? <div className="actions"><Link className="button" href={href}>Open</Link></div> : null}
              </div>
            )
          }) : <p className="meta">Bookmark a class and it will appear here.</p>}
        </div>

        <div className="card">
          <div className="eyebrow">Bookmarked Courses</div>
          <h2 style={{ fontSize: 30 }}>Saved courses</h2>
          {courseBookmarks.length ? courseBookmarks.map((item: any) => {
            const course = item.courses
            const offerings = (course?.course_offerings ?? []).filter((offering: any) => offering.status === 'published').sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            const offering = offerings[0]
            const href = course?.slug && offering?.slug ? `/courses/${course.slug}/${offering.slug}` : course?.slug ? `/courses/${course.slug}` : null
            return (
              <div key={item.course_id} style={{ padding: '14px 0', borderTop: '1px solid var(--line)' }}>
                <strong>{course?.canonical_number ? `Course ${course.canonical_number} · ` : ''}{course?.title ?? 'Course'}</strong>
                {offering?.label ? <div className="meta">{offering.label}</div> : null}
                {href ? <div className="actions"><Link className="button" href={href}>Open</Link></div> : null}
              </div>
            )
          }) : <p className="meta">Bookmark a course and it will appear here.</p>}
        </div>
      </section>

      <section className="section card">
        <div className="eyebrow">Transcript bookmarks</div>
        <h2 style={{ fontSize: 32 }}>Saved passages</h2>
        {paragraphBookmarks.length ? paragraphBookmarks.map((item: any) => {
          const paragraph = item.transcript_paragraphs
          const transcript = paragraph?.transcripts
          const session = transcript?.sessions
          const basePath = sessionPath(session)
          const href = basePath && paragraph?.id ? `${basePath}#paragraph-${paragraph.id}` : basePath
          return (
            <div key={item.paragraph_id} style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
              <div style={{ lineHeight: 1.65 }}>
                {paragraph?.speaker ? <strong>{paragraph.speaker}: </strong> : null}
                {clip(paragraph?.body ?? 'Saved transcript passage')}
              </div>
              <div className="meta" style={{ marginTop: 8 }}>{session?.code ? `${session.code} · ` : ''}{session?.title ?? 'Reference Transcript'}</div>
              {href ? <div className="actions"><Link className="button" href={href}>Open passage</Link></div> : null}
            </div>
          )
        }) : <p className="meta">Bookmark a transcript passage and it will appear here.</p>}
      </section>

      <section className="section"><Link className="button" href="/my-learning">← My Learning</Link></section>
    </main>
  )
}
