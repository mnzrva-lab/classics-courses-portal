import { createClient } from '@/lib/supabase/server'
import { buildStudyDocxResponse, docxHeading, docxMeta, docxParagraph, docxPassage, docxTextBlocks, docxTitle } from '@/lib/study-docx'

export const runtime = 'nodejs'

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
  const requestedFormat = url.searchParams.get('format')
  const format = requestedFormat === 'txt' ? 'txt' : requestedFormat === 'docx' ? 'docx' : 'md'
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

  const exportedAt = new Date().toISOString()
  const markdown: string[] = ['# My Study Notes', '', `Exported: ${exportedAt}`, '']
  const plain: string[] = ['MY STUDY NOTES', '', `Exported: ${exportedAt}`, '']
  const docxChildren = [docxTitle('My Study Notes'), docxMeta(`Exported: ${exportedAt}`)]

  for (const item of notes ?? []) {
    const session = item.sessions as any
    const paragraph = item.transcript_paragraphs as any
    const courseTitle = session?.courses?.title ?? 'Course'
    const offeringText = session?.course_offerings?.label ?? null
    const offeringLabel = offeringText ? ` · ${offeringText}` : ''
    const sessionLabel = `${session?.code ? `${session.code} · ` : ''}${session?.title ?? 'Session'}`
    const time = timestamp(paragraph?.start_seconds)

    markdown.push(`## ${courseTitle}${offeringLabel}`, '', `**${sessionLabel}**`, '')
    plain.push(`${courseTitle}${offeringLabel}`, sessionLabel, '')
    docxChildren.push(docxHeading(`${courseTitle}${offeringLabel}`, 1), docxHeading(sessionLabel, 2))

    if (item.paragraph_id && paragraph) {
      const passageLabel = `Passage${time ? ` · ${time}` : ''}${paragraph.is_active === false ? ' · earlier transcript revision' : ''}`
      const passageText = `${paragraph.speaker ? `${paragraph.speaker}: ` : ''}${paragraph.body ?? ''}`
      markdown.push(`> **${passageLabel}**`, `> ${passageText.replace(/\n/g, '\n> ')}`, '')
      plain.push(passageLabel.toUpperCase(), passageText, '')
      docxChildren.push(...docxPassage(passageLabel, passageText))
    }

    markdown.push(item.note, '', `Saved: ${item.updated_at}`, '', '---', '')
    plain.push(item.note, '', `Saved: ${item.updated_at}`, '', '----------------------------------------', '')
    docxChildren.push(docxHeading('Your note', 3), ...docxTextBlocks(item.note), docxMeta(`Saved: ${item.updated_at}`))
  }

  if (!notes?.length) {
    markdown.push('_No private notes saved._', '')
    plain.push('No private notes saved.', '')
    docxChildren.push(docxParagraph('No private notes saved.', { italics: true }))
  }

  const baseName = sanitizeFileName('classics-courses-notes')

  if (format === 'docx') {
    return buildStudyDocxResponse({
      title: 'My Study Notes',
      filename: `${baseName}.docx`,
      children: docxChildren,
    })
  }

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
