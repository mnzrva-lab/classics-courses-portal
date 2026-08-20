import { createClient } from '@/lib/supabase/server'

function sanitizeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'notes'
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
    .select('id, note, updated_at, sessions(code, title, courses(title), course_offerings(label))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) return new Response('Could not export notes.', { status: 500 })

  const markdown: string[] = ['# My Study Notes', '', `Exported: ${new Date().toISOString()}`, '']
  const plain: string[] = ['MY STUDY NOTES', '', `Exported: ${new Date().toISOString()}`, '']

  for (const item of notes ?? []) {
    const session = item.sessions as any
    const courseTitle = session?.courses?.title ?? 'Course'
    const offeringLabel = session?.course_offerings?.label ? ` · ${session.course_offerings.label}` : ''
    const sessionLabel = `${session?.code ? `${session.code} · ` : ''}${session?.title ?? 'Session'}`

    markdown.push(`## ${courseTitle}${offeringLabel}`, '', `**${sessionLabel}**`, '', item.note, '', `Saved: ${item.updated_at}`, '', '---', '')
    plain.push(`${courseTitle}${offeringLabel}`, sessionLabel, '', item.note, '', `Saved: ${item.updated_at}`, '', '----------------------------------------', '')
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
