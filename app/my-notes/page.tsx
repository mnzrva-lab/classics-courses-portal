import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteNote, updateNote } from './actions'

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

function codeOrder(code: string | null | undefined) {
  if (!code) return 9999
  const match = code.match(/(\d+)/)
  const value = match ? Number(match[1]) : 9999
  const prefix = code.toUpperCase().startsWith('C') ? 0 : code.toUpperCase().startsWith('M') ? 100 : 200
  return prefix + value
}

export default async function MyNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; saved?: string }>
}) {
  const { sort, saved } = await searchParams
  const sortMode = sort === 'class' ? 'class' : 'latest'
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

  const courseGroups = new Map<string, any>()
  for (const item of notes as any[]) {
    const session = item.sessions
    const course = session?.courses
    const courseKey = course?.slug ?? 'other'
    if (!courseGroups.has(courseKey)) {
      courseGroups.set(courseKey, {
        key: courseKey,
        title: course?.title ?? 'Other program',
        canonicalNumber: course?.canonical_number ?? null,
        latest: item.updated_at,
        sessions: new Map<string, any>(),
      })
    }

    const courseGroup = courseGroups.get(courseKey)
    if (new Date(item.updated_at).getTime() > new Date(courseGroup.latest).getTime()) courseGroup.latest = item.updated_at

    const sessionKey = session?.id ?? `note-${item.id}`
    if (!courseGroup.sessions.has(sessionKey)) {
      courseGroup.sessions.set(sessionKey, {
        key: sessionKey,
        session,
        latest: item.updated_at,
        notes: [],
      })
    }

    const sessionGroup = courseGroup.sessions.get(sessionKey)
    if (new Date(item.updated_at).getTime() > new Date(sessionGroup.latest).getTime()) sessionGroup.latest = item.updated_at
    sessionGroup.notes.push(item)
  }

  const groupedNotes = Array.from(courseGroups.values())
    .map((group: any) => ({
      ...group,
      sessions: Array.from(group.sessions.values()).sort((a: any, b: any) => {
        if (sortMode === 'latest') return new Date(b.latest).getTime() - new Date(a.latest).getTime()
        return codeOrder(a.session?.code) - codeOrder(b.session?.code) || String(a.session?.title ?? '').localeCompare(String(b.session?.title ?? ''))
      }),
    }))
    .sort((a: any, b: any) => {
      if (sortMode === 'latest') return new Date(b.latest).getTime() - new Date(a.latest).getTime()
      const aNumber = a.canonicalNumber ?? 9999
      const bNumber = b.canonicalNumber ?? 9999
      return aNumber - bNumber || String(a.title).localeCompare(String(b.title))
    })

  const savedMessage = saved === 'note' ? 'Note updated.' : saved === 'deleted' ? 'Note deleted.' : null

  return (
    <main className="container page">
      <div className="eyebrow">Your private study space</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>My Notes</h1>
      <p className="lead">Notes grouped by course and class, with your saved courses, classes, and transcript passages in the same study space.</p>

      {savedMessage ? <div className="card completed section">{savedMessage}</div> : null}

      <section className="section card">
        <div className="eyebrow">View</div>
        <div className="actions">
          <Link className="button" href="/my-notes?sort=latest">Latest activity</Link>
          <Link className="button" href="/my-notes?sort=class">Course &amp; class order</Link>
          <Link className="button" href="/account">Privacy &amp; Data</Link>
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">Private notes</div>
        <h2 style={{ fontSize: 32 }}>Course → class → note</h2>
        {groupedNotes.length ? groupedNotes.map((courseGroup: any) => (
          <div className="card" key={courseGroup.key} style={{ marginBottom: 22 }}>
            <div className="eyebrow">{courseGroup.canonicalNumber ? `Course ${courseGroup.canonicalNumber}` : 'Program'}</div>
            <h2 style={{ fontSize: 30 }}>{courseGroup.title}</h2>

            {courseGroup.sessions.map((sessionGroup: any) => {
              const session = sessionGroup.session
              const href = sessionPath(session)
              return (
                <div key={sessionGroup.key} style={{ padding: '20px 0', borderTop: '1px solid var(--line)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
                    <div>
                      <strong>{session?.code ? `${session.code} · ` : ''}{session?.title ?? 'Session'}</strong>
                      {session?.course_offerings?.label ? <div className="meta">{session.course_offerings.label}</div> : null}
                    </div>
                    {href ? <Link className="button" href={href}>Open class</Link> : null}
                  </div>

                  {sessionGroup.notes.map((item: any) => (
                    <div key={item.id} style={{ padding: '16px 0', borderTop: '1px solid var(--line)', marginTop: 14 }}>
                      <form className="form-stack" action={updateNote.bind(null, item.id)}>
                        <textarea className="input" name="note" rows={5} defaultValue={item.note} required />
                        <div className="meta">Updated {new Date(item.updated_at).toLocaleString()}</div>
                        <div className="actions"><button className="button" type="submit">Save changes</button></div>
                      </form>
                      <form action={deleteNote.bind(null, item.id)} style={{ marginTop: 8 }}>
                        <button className="button" type="submit">Delete note</button>
                      </form>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )) : <div className="card"><p className="meta">Notes you save from class pages will appear here.</p></div>}
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
                <div className="meta">{session?.courses?.title ?? ''}{session?.course_offerings?.label ? ` · ${session.course_offerings.label}` : ''}</div>
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
              <div className="meta" style={{ marginTop: 8 }}>
                {session?.courses?.title ?? ''}{session?.course_offerings?.label ? ` · ${session.course_offerings.label}` : ''}{session?.code ? ` · ${session.code}` : ''}
              </div>
              {href ? <div className="actions"><Link className="button" href={href}>Open passage</Link></div> : null}
            </div>
          )
        }) : <p className="meta">Bookmark a transcript passage and it will appear here.</p>}
      </section>

      <section className="section"><Link className="button" href="/my-learning">← My Learning</Link></section>
    </main>
  )
}
