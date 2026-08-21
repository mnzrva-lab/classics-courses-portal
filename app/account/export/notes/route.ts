import { createClient } from '@/lib/supabase/server'

function sanitizeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'notes'
}

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
  const format = url.searchParams.get('format') === 'txt' ? 'txt' : 'md'
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub as string | undefined

  if (!userId) return new Response('Sign in required.', { status: 401 })

  const { data: notes, error } = await supabase
    .from('student_notes')
    .select('id, note, paragraph_id, updated_at, transcript_paragraphs(body, speaker, start_seconds, is_active), sessions(code, title, courses(title), course_offerings(label))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) return new Response('Could not export notes.', { status: 500 })

  const markdown: string[] = ['# My Study Notes', '', `Exported: ${new Date().toISOString()}`, '']
  const plain: string[] = ['MY STUDY NOTES', '', `Exported: ${new Date().toISOString()}`, '']

  for (const item of notes ?? []) {
    const session = item.sessions as any
    const paragraph = item.transcript_paragraphs as any
    const courseTitle = session?.courses?.title ?? 'Course'
    const offeringLabel = session?.course_offerings?.label ? ` · ${session.course_offerings.label}` : ''
    const sessionLabel = `${session?.code ? `${session.code} · ` : ''}${session?.title ?? 'Session'}`
    const time = timestamp(paragraph?.start_seconds)

    markdown.push(`## ${courseTitle}${offeringLabel}`, '', `**${sessionLabel}**`, '')
    plain.push(`${courseTitle}${offeringLabel}`, sessionLabel, '')

    if (item.paragraph_id && paragraph) {
      const passageLabel = `Passage${time ? ` · ${time}` : ''}${paragraph.is_active === false ? ' · earlier transcript revision' : ''}`
      const passageText = `${paragraph.speaker ? `${paragraph.speaker}: ` : ''}${paragraph.body ?? ''}`
      markdown.push(`> **${passageLabel}**`, `> ${passageText.replace(/\n/g, '\n> ')}`, '')
      plain.push(passageLabel.toUpperCase(), passageText, '')
    }

    markdown.push(item.note, '', `Saved: ${item.updated_at}`, '', '---', '')
    plain.push(item.note, '', `Saved: ${item.updated_at}`, '', '----------------------------------------', '')
  }

  if (!notes?.length) {
    markdown.push('_No private notes saved._', '')
    plain.push('No private notes saved.', '')
  }

  const baseName = sanitizeFileName('classics-courses-notes')
  const body = format === 'txt' ? plain.join('\n') : markdown.join('\n')
  const contentType = format === 'txt' ? 'text/plain; charset=utf-8' : 'text/markdown; charset=utf-8'

  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${baseName}.${format}"`,
      'Cache-Control': 'no-store',
    },
  })
}
