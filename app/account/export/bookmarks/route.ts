import { createClient } from '@/lib/supabase/server'
import { buildStudyDocxResponse, docxBullet, docxHeading, docxMeta, docxParagraph, docxPassage, docxTitle } from '@/lib/study-docx'

export const runtime = 'nodejs'

function timestamp(seconds: number | null | undefined) {
  if (seconds == null) return null
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const requestedFormat = url.searchParams.get('format')
  const format = requestedFormat === 'txt' ? 'txt' : requestedFormat === 'docx' ? 'docx' : 'md'
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub as string | undefined

  if (!userId) return new Response('Sign in required.', { status: 401 })

  const [courseResult, sessionResult, meditationResult, paragraphResult] = await Promise.all([
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
      .from('user_meditation_bookmarks')
      .select('created_at, meditations(name, slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('user_paragraph_bookmarks')
      .select('created_at, transcript_paragraphs(body, speaker, start_seconds, is_active, transcripts(sessions(code, title, courses(title, canonical_number), course_offerings(label))))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  ])

  if (courseResult.error || sessionResult.error || meditationResult.error || paragraphResult.error) {
    return new Response('Could not export bookmarks.', { status: 500 })
  }

  const exportedAt = new Date().toISOString()
  const markdown: string[] = ['# My Study Bookmarks', '', `Exported: ${exportedAt}`, '', '## Courses', '']
  const plain: string[] = ['MY STUDY BOOKMARKS', '', `Exported: ${exportedAt}`, '', 'COURSES', '']
  const docxChildren = [docxTitle('My Study Bookmarks'), docxMeta(`Exported: ${exportedAt}`), docxHeading('Courses', 1)]

  const courses = courseResult.data ?? []
  if (courses.length === 0) {
    markdown.push('_No bookmarked courses._', '')
    plain.push('No bookmarked courses.', '')
    docxChildren.push(docxParagraph('No bookmarked courses.', { italics: true }))
  }
  for (const item of courses) {
    const course = item.courses as any
    const text = `${course?.canonical_number ? `Course ${course.canonical_number} · ` : ''}${course?.title ?? 'Course'} (${item.created_at})`
    markdown.push(`- ${text}`)
    plain.push(`- ${text}`)
    docxChildren.push(docxBullet(text))
  }

  markdown.push('', '## Classes', '')
  plain.push('', 'CLASSES', '')
  docxChildren.push(docxHeading('Classes', 1))
  const sessions = sessionResult.data ?? []
  if (sessions.length === 0) {
    markdown.push('_No bookmarked classes._', '')
    plain.push('No bookmarked classes.', '')
    docxChildren.push(docxParagraph('No bookmarked classes.', { italics: true }))
  }
  for (const item of sessions) {
    const session = item.sessions as any
    const text = `${session?.courses?.title ?? 'Course'}${session?.course_offerings?.label ? ` · ${session.course_offerings.label}` : ''} · ${session?.code ? `${session.code} · ` : ''}${session?.title ?? 'Session'} (${item.created_at})`
    markdown.push(`- ${text}`)
    plain.push(`- ${text}`)
    docxChildren.push(docxBullet(text))
  }

  markdown.push('', '## Meditations', '')
  plain.push('', 'MEDITATIONS', '')
  docxChildren.push(docxHeading('Meditations', 1))
  const meditations = meditationResult.data ?? []
  if (meditations.length === 0) {
    markdown.push('_No bookmarked meditations._', '')
    plain.push('No bookmarked meditations.', '')
    docxChildren.push(docxParagraph('No bookmarked meditations.', { italics: true }))
  }
  for (const item of meditations) {
    const meditation = item.meditations as any
    const text = `${meditation?.name ?? 'Meditation'} (${item.created_at})`
    markdown.push(`- ${text}`)
    plain.push(`- ${text}`)
    docxChildren.push(docxBullet(text))
  }

  markdown.push('', '## Transcript Passages', '')
  plain.push('', 'TRANSCRIPT PASSAGES', '')
  docxChildren.push(docxHeading('Transcript Passages', 1))
  const paragraphs = paragraphResult.data ?? []
  if (paragraphs.length === 0) {
    markdown.push('_No bookmarked transcript passages._', '')
    plain.push('No bookmarked transcript passages.', '')
    docxChildren.push(docxParagraph('No bookmarked transcript passages.', { italics: true }))
  }
  for (const item of paragraphs) {
    const paragraph = item.transcript_paragraphs as any
    const session = paragraph?.transcripts?.sessions
    const time = timestamp(paragraph?.start_seconds)
    const courseLabel = session?.courses?.canonical_number
      ? `Course ${session.courses.canonical_number}`
      : session?.courses?.title ?? 'Course'
    const source = [
      courseLabel,
      session?.course_offerings?.label,
      session?.code ? `${session.code} · ${session.title}` : session?.title,
      time,
    ].filter(Boolean).join(' · ')
    const passageText = `${paragraph?.speaker ? `${paragraph.speaker}: ` : ''}${paragraph?.body ?? 'Saved transcript excerpt'}`
    const revisionLabel = paragraph?.is_active === false ? ' · earlier transcript revision' : ''

    markdown.push(`### ${source}${revisionLabel}`, '', passageText, '', `Saved: ${item.created_at}`, '')
    plain.push(`${source}${revisionLabel}`, passageText, '', `Saved: ${item.created_at}`, '', '----------------------------------------', '')
    docxChildren.push(docxHeading(`${source}${revisionLabel}`, 2), ...docxPassage('Saved passage', passageText), docxMeta(`Saved: ${item.created_at}`))
  }

  if (format === 'docx') {
    return buildStudyDocxResponse({
      title: 'My Study Bookmarks',
      filename: 'classics-courses-bookmarks.docx',
      children: docxChildren,
    })
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
