import { createClient } from '@/lib/supabase/server'

export async function GET() {
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

  const lines: string[] = [
    '# My Study Bookmarks',
    '',
    `Exported: ${new Date().toISOString()}`,
    '',
    '## Courses',
    '',
  ]

  const courses = courseResult.data ?? []
  if (courses.length === 0) lines.push('_No bookmarked courses._', '')
  for (const item of courses) {
    const course = item.courses as any
    lines.push(`- ${course?.canonical_number ? `Course ${course.canonical_number} · ` : ''}${course?.title ?? 'Course'} (${item.created_at})`)
  }

  lines.push('', '## Classes', '')
  const sessions = sessionResult.data ?? []
  if (sessions.length === 0) lines.push('_No bookmarked classes._', '')
  for (const item of sessions) {
    const session = item.sessions as any
    lines.push(`- ${session?.courses?.title ?? 'Course'}${session?.course_offerings?.label ? ` · ${session.course_offerings.label}` : ''} · ${session?.code ? `${session.code} · ` : ''}${session?.title ?? 'Session'} (${item.created_at})`)
  }

  lines.push('', '## Transcript Passages', '')
  const paragraphs = paragraphResult.data ?? []
  if (paragraphs.length === 0) lines.push('_No bookmarked transcript passages._', '')
  for (const item of paragraphs) {
    const paragraph = item.transcript_paragraphs as any
    const session = paragraph?.transcripts?.sessions
    lines.push(`### ${session?.code ? `${session.code} · ` : ''}${session?.title ?? 'Reference Transcript'}`)
    lines.push('')
    if (paragraph?.speaker) lines.push(`**${paragraph.speaker}:**`)
    if (paragraph?.body) lines.push(paragraph.body)
    lines.push('')
    lines.push(`Saved: ${item.created_at}`)
    lines.push('')
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="classics-courses-bookmarks.md"',
      'Cache-Control': 'no-store',
    },
  })
}
