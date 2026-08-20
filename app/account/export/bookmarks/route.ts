import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const format = url.searchParams.get('format') === 'txt' ? 'txt' : 'md'
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub as string | undefined

  if (!userId) return new Response('Sign in required.', { status: 401 })

  const [courseResult, sessionResult, paragraphResult] = await Promise.all([
    supabase
      .from('user_course_bookmarks')
      .select('created_at, courses(title, canonical_number)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_session_bookmarks')
      .select('created_at, sessions(code, title, courses(title), course_offerings(label))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_paragraph_bookmarks')
      .select('created_at, transcript_paragraphs(body, speaker, start_seconds, transcripts(sessions(code, title, courses(title), course_offerings(label))))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  if (courseResult.error || sessionResult.error || paragraphResult.error) {
    return new Response('Could not export bookmarks.', { status: 500 })
  }

  const markdown: string[] = ['# My Study Bookmarks', '', `Exported: ${new Date().toISOString()}`, '', '## Courses', '']
  const plain: string[] = ['MY STUDY BOOKMARKS', '', `Exported: ${new Date().toISOString()}`, '', 'COURSES', '']

  const courses = courseResult.data ?? []
  if (courses.length === 0) {
    markdown.push('_No bookmarked courses._', '')
    plain.push('No bookmarked courses.', '')
  }
  for (const item of courses) {
    const course = item.courses as any
    const text = `${course?.canonical_number ? `Course ${course.canonical_number} · ` : ''}${course?.title ?? 'Course'} (${item.created_at})`
    markdown.push(`- ${text}`)
    plain.push(`- ${text}`)
  }

  markdown.push('', '## Classes', '')
  plain.push('', 'CLASSES', '')
  const sessions = sessionResult.data ?? []
  if (sessions.length === 0) {
    markdown.push('_No bookmarked classes._', '')
    plain.push('No bookmarked classes.', '')
  }
  for (const item of sessions) {
    const session = item.sessions as any
    const text = `${session?.courses?.title ?? 'Course'}${session?.course_offerings?.label ? ` · ${session.course_offerings.label}` : ''} · ${session?.code ? `${session.code} · ` : ''}${session?.title ?? 'Session'} (${item.created_at})`
    markdown.push(`- ${text}`)
    plain.push(`- ${text}`)
  }

  markdown.push('', '## Transcript Passages', '')
  plain.push('', 'TRANSCRIPT PASSAGES', '')
  const paragraphs = paragraphResult.data ?? []
  if (paragraphs.length === 0) {
    markdown.push('_No bookmarked transcript passages._', '')
    plain.push('No bookmarked transcript passages.', '')
  }
  for (const item of paragraphs) {
    const paragraph = item.transcript_paragraphs as any
    const session = paragraph?.transcripts?.sessions
    const title = `${session?.code ? `${session.code} · ` : ''}${session?.title ?? 'Reference Transcript'}`

    markdown.push(`### ${title}`, '')
    if (paragraph?.speaker) markdown.push(`**${paragraph.speaker}:**`)
    if (paragraph?.body) markdown.push(paragraph.body)
    markdown.push('', `Saved: ${item.created_at}`, '')

    plain.push(title)
    if (paragraph?.speaker) plain.push(`${paragraph.speaker}:`)
    if (paragraph?.body) plain.push(paragraph.body)
    plain.push('', `Saved: ${item.created_at}`, '', '----------------------------------------', '')
  }

  const body = format === 'txt' ? plain.join('\n') : markdown.join('\n')
  const contentType = format === 'txt' ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8'

  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="classics-courses-bookmarks.${format}"`,
      'Cache-Control': 'no-store',
    },
  })
}
