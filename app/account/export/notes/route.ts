import { createClient } from '@/lib/supabase/server'

function sanitizeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'notes'
}

export async function GET() {
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

  const lines: string[] = [
    '# My Study Notes',
    '',
    `Exported: ${new Date().toISOString()}`,
    '',
  ]

  for (const item of notes ?? []) {
    const session = item.sessions as any
    const courseTitle = session?.courses?.title ?? 'Course'
    const offeringLabel = session?.course_offerings?.label ? ` · ${session.course_offerings.label}` : ''
    const sessionLabel = `${session?.code ? `${session.code} · ` : ''}${session?.title ?? 'Session'}`
    lines.push(`## ${courseTitle}${offeringLabel}`)
    lines.push('')
    lines.push(`**${sessionLabel}**`)
    lines.push('')
    lines.push(item.note)
    lines.push('')
    lines.push(`Saved: ${item.updated_at}`)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  if (!notes?.length) lines.push('_No private notes saved._', '')

  const fileName = `${sanitizeFileName('classics-courses-notes')}.md`
  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
