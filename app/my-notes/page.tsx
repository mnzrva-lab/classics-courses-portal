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

function formatTimestamp(seconds: number | null | undefined) {
  if (seconds == null) return null
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function codeOrder(code: string | null | undefined) {
  if (!code) return 9999
  const match = code.match(/(\d+)/)
  const value = match ? Number(match[1]) : 9999
  const prefix = code.toUpperCase().startsWith('C') ? 0 : code.toUpperCase().startsWith('M') ? 100 : 200
  return prefix + value
}

function includesQuery(values: Array<string | null | undefined>, query: string) {
  if (!query) return true
  return values.some((value) => String(value ?? '').toLowerCase().includes(query))
}

export default async function MyNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; saved?: string; q?: string; passage?: string }>
}) {
  const { sort, saved, q, passage } = await searchParams
  const sortMode = sort === 'class' ? 'class' : 'latest'
  const searchText = (q ?? '').trim()
  const normalizedSearch = searchText.toLowerCase()
  const passageId = (passage ?? '').trim()
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const [notesResult, sessionBookmarksResult, paragraphBookmarksResult, courseBookmarksResult] = await Promise.all([
    supabase
      .from('student_notes')
      .select('id, note, paragraph_id, updated_at, transcript_paragraphs(id, body, speaker, start_seconds, is_active), sessions(id, slug, code, title, courses(slug, title, canonical_number), course_offerings(slug, label))')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    supabase
      .from('user_session_bookmarks')
      .select('session_id, created_at, sessions(id, slug, code, title, courses(slug, title, canonical_number), course_offerings(slug, label))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_paragraph_bookmarks')
      .select('paragraph_id, created_at, transcript_paragraphs(id, body, speaker, start_seconds, is_active, transcripts(session_id, sessions(id, slug, code, title, courses(slug, title, canonical_number), course_offerings(slug, label))))')
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

  const visibleNotes = passageId
    ? (notes as any[]).filter((item) => item.paragraph_id === passageId)
    : normalizedSearch
      ? (notes as any[]).filter((item) => {
          const session = item.sessions
          const paragraph = item.transcript_paragraphs
          return includesQuery([
            item.note,
            paragraph?.body,
            paragraph?.speaker,
            session?.code,
            session?.title,
            session?.courses?.title,
            session?.course_offerings?.label,
          ], normalizedSearch)
        })
      : notes

  const visibleParagraphBookmarks = passageId
    ? (paragraphBookmarks as any[]).filter((item) => item.paragraph_id === passageId)
    : normalizedSearch
      ? (paragraphBookmarks as any[]).filter((item) => {
          const paragraph = item.transcript_paragraphs
          const session = paragraph?.transcripts?.sessions
          return includesQuery([
            paragraph?.body,
            paragraph?.speaker,
            session?.code,
            session?.title,
            session?.courses?.title,
            session?.course_offerings?.label,
          ], normalizedSearch)
        })
      : paragraphBookmarks

  const courseGroups = new Map<string, any>()
  for (const item of visibleNotes as any[]) {
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
      <p className="lead">Keep class notes and notes tied to exact transcript passages, together with your saved courses, classes, and passages.</p>

      {savedMessage ? <div className="card completed section">{savedMessage}</div> : null}
      {passageId ? (
        <div className="card sage section">
          <strong>Showing notes for one transcript passage</strong>
          <div className="meta">This view opens directly from the passage in the class transcript.</div>
          <div className="actions"><Link className="button" href="/my-notes">Show all My Notes</Link></div>
        </div>
      ) : null}

      <section className="section card">
        <div className="eyebrow">Find something you saved</div>
        <form className="form-stack" method="get" action="/my-notes">
          <input type="hidden" name="sort" value={sortMode} />
          <label>Search your notes and saved transcript passages
            <input className="input" type="search" name="q" defaultValue={searchText} placeholder="A phrase from your note or the teaching…" />
          </label>
          <div className="actions">
            <button className="button red" type="submit">Search My Notes</button>
            {searchText || passageId ? <Link className="button" href={`/my-notes?sort=${sortMode}`}>Clear filters</Link> : null}
          </div>
        </form>
      </section>

      <section className="section card">
        <div className="eyebrow">View</div>
        <div className="actions">
          <Link className="button" href={`/my-notes?sort=latest${searchText ? `&q=${encodeURIComponent(searchText)}` : ''}${passageId ? `&passage=${encodeURIComponent(passageId)}` : ''}`}>Latest activity</Link>
          <Link className="button" href={`/my-notes?sort=class${searchText ? `&q=${encodeURIComponent(searchText)}` : ''}${passageId ? `&passage=${encodeURIComponent(passageId)}` : ''}`}>Course &amp; class order</Link>
          <Link className="button" href="/account">Privacy &amp; Data</Link>
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">Private notes</div>
        <h2 style={{ fontSize: 32 }}>Course → class → note</h2>
        {searchText ? <p className="meta">Showing notes that match “{searchText}”.</p> : null}
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

                  {sessionGroup.notes.map((item: any) => {
                    const paragraph = item.transcript_paragraphs
                    const timestamp = formatTimestamp(paragraph?.start_seconds)
                    const currentParagraph = paragraph?.is_active !== false
                    const passageHref = href && item.paragraph_id && currentParagraph ? `${href}#paragraph-${item.paragraph_id}` : href
                    return (
                      <div key={item.id} style={{ padding: '16px 0', borderTop: '1px solid var(--line)', marginTop: 14 }}>
                        {item.paragraph_id && paragraph ? (
                          <div className="note" style={{ marginBottom: 12 }}>
                            <div className="eyebrow">Passage note{timestamp ? ` · ${timestamp}` : ''}</div>
                            <div style={{ lineHeight: 1.65, marginTop: 6 }}>
                              {paragraph.speaker ? <strong>{paragraph.speaker}: </strong> : null}
                              {clip(paragraph.body, 300)}
                            </div>
                            {!currentParagraph ? <div className="meta" style={{ marginTop: 8 }}>This note points to an earlier transcript revision. Your note and the original passage are still kept here.</div> : null}
                            {passageHref ? <div className="actions"><Link className="button" href={passageHref}>{currentParagraph ? 'Open passage' : 'Open current class'}</Link></div> : null}
                          </div>
                        ) : <div className="eyebrow" style={{ marginBottom: 8 }}>Class note</div>}

                        <form className="form-stack" action={updateNote.bind(null, item.id)}>
                          <textarea className="input" name="note" rows={5} defaultValue={item.note} required />
                          <div className="meta">Updated {new Date(item.updated_at).toLocaleString()}</div>
                          <div className="actions"><button className="button" type="submit">Save changes</button></div>
                        </form>
                        <form action={deleteNote.bind(null, item.id)} style={{ marginTop: 8 }}>
                          <button className="button" type="submit">Delete note</button>
                        </form>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )) : <div className="card"><p className="meta">{passageId ? 'No private notes have been saved for this passage yet.' : searchText ? 'No private notes matched this search.' : 'Notes you save from class pages will appear here.'}</p></div>}
      </section>

      {!searchText && !passageId ? (
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
      ) : null}

      <section className="section card">
        <div className="eyebrow">Saved passages</div>
        <h2 style={{ fontSize: 32 }}>Transcript bookmarks</h2>
        {searchText ? <p className="meta">Showing saved passages that match “{searchText}”.</p> : null}
        {visibleParagraphBookmarks.length ? (visibleParagraphBookmarks as any[]).map((item: any) => {
          const paragraph = item.transcript_paragraphs
          const transcript = paragraph?.transcripts
          const session = transcript?.sessions
          const basePath = sessionPath(session)
          const currentParagraph = paragraph?.is_active !== false
          const href = basePath && paragraph?.id && currentParagraph ? `${basePath}#paragraph-${paragraph.id}` : basePath
          const timestamp = formatTimestamp(paragraph?.start_seconds)
          return (
            <div key={item.paragraph_id} style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
              <div className="meta">{timestamp ? `${timestamp} · ` : ''}{session?.courses?.title ?? ''}{session?.course_offerings?.label ? ` · ${session.course_offerings.label}` : ''}{session?.code ? ` · ${session.code}` : ''}</div>
              <div style={{ lineHeight: 1.65, marginTop: 6 }}>
                {paragraph?.speaker ? <strong>{paragraph.speaker}: </strong> : null}
                {clip(paragraph?.body ?? 'Saved transcript excerpt')}
              </div>
              {!currentParagraph ? <div className="meta" style={{ marginTop: 8 }}>This bookmark is from an earlier transcript revision. The exact passage is no longer in the current transcript, but your saved text has been kept.</div> : null}
              {href ? <div className="actions"><Link className="button" href={href}>{currentParagraph ? 'Open passage' : 'Open current class'}</Link></div> : null}
            </div>
          )
        }) : <p className="meta">{passageId ? 'This passage is not bookmarked.' : searchText ? 'No saved transcript passages matched this search.' : 'Bookmark transcript text and it will appear here.'}</p>}
      </section>

      <section className="section"><Link className="button" href="/my-learning">← My Learning</Link></section>
    </main>
  )
}
