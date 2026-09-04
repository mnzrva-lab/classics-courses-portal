import { createClient } from '@/lib/supabase/server'
import { buildStudyDocxResponse, docxBullet, docxHeading, docxMeta, docxParagraph, docxTitle } from '@/lib/study-docx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeName(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'study-material'
}

function timestamp(seconds: number | null) {
  if (seconds == null) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function markdownToDocx(markdown: string) {
  const children = []
  for (const raw of String(markdown ?? '').replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('### ')) children.push(docxHeading(line.slice(4), 3))
    else if (line.startsWith('## ')) children.push(docxHeading(line.slice(3), 2))
    else if (line.startsWith('# ')) children.push(docxHeading(line.slice(2), 1))
    else if (/^[-*]\s+/.test(line)) children.push(docxBullet(line.replace(/^[-*]\s+/, '').replace(/[*_`]/g, '')))
    else children.push(docxParagraph(line.replace(/[*_`]/g, '')))
  }
  return children
}

export async function GET(request: Request, { params }: { params: Promise<{ courseSlug: string; offeringSlug: string; sessionSlug: string }> }) {
  const { courseSlug, offeringSlug, sessionSlug } = await params
  const url = new URL(request.url)
  const kind = url.searchParams.get('kind') === 'study-notes' ? 'study-notes' : 'transcript'
  const format = url.searchParams.get('format') === 'docx' ? 'docx' : 'txt'
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, code, courses!inner(slug, title, canonical_number, status), course_offerings!inner(slug, label, status)')
    .eq('slug', sessionSlug)
    .eq('status', 'published')
    .eq('courses.slug', courseSlug)
    .eq('courses.status', 'published')
    .eq('course_offerings.slug', offeringSlug)
    .eq('course_offerings.status', 'published')
    .single()

  if (!session) return new Response('Session not found.', { status: 404 })
  const course = session.courses as any
  const offering = session.course_offerings as any
  const source = `${course.canonical_number ? `Course ${course.canonical_number}` : course.title} · ${offering.label} · ${session.code ? `${session.code} · ` : ''}${session.title}`
  const baseName = safeName(`${course.title}-${offering.label}-${session.title}-${kind}`)

  if (kind === 'study-notes') {
    const { data: notes } = await supabase.from('study_notes').select('title, summary, content_markdown, disclaimer').eq('session_id', session.id).eq('status', 'published').maybeSingle()
    if (!notes) return new Response('Study Notes not found.', { status: 404 })

    if (format === 'docx') {
      return buildStudyDocxResponse({
        title: notes.title || 'Study Notes',
        filename: `${baseName}.docx`,
        children: [docxTitle(notes.title || 'Study Notes'), docxMeta(source), ...(notes.summary ? [docxHeading('Top ideas', 2), docxParagraph(notes.summary)] : []), ...markdownToDocx(notes.content_markdown), ...(notes.disclaimer ? [docxMeta(notes.disclaimer)] : [])],
      })
    }
    const body = [notes.title || 'STUDY NOTES', source, '', notes.summary ? `TOP IDEAS\n${notes.summary}\n` : '', notes.content_markdown, '', notes.disclaimer].filter(Boolean).join('\n')
    return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${baseName}.txt"`, 'Cache-Control': 'no-store' } })
  }

  const { data: transcript } = await supabase.from('transcripts').select('id, title, disclaimer').eq('session_id', session.id).eq('status', 'published').maybeSingle()
  if (!transcript) return new Response('Transcript not found.', { status: 404 })
  const [{ data: sections }, { data: paragraphs }] = await Promise.all([
    supabase.from('transcript_sections').select('id, title').eq('transcript_id', transcript.id).order('sort_order'),
    supabase.from('transcript_paragraphs').select('section_id, speaker, body, start_seconds').eq('transcript_id', transcript.id).eq('is_active', true).order('sort_order'),
  ])
  const sectionMap = new Map((sections ?? []).map((section: any) => [section.id, section.title]))
  let previousSection: string | null = null

  if (format === 'docx') {
    const children = [docxTitle('Reference Transcript'), docxMeta(source), ...(transcript.disclaimer ? [docxMeta(transcript.disclaimer)] : [])]
    for (const paragraph of paragraphs ?? []) {
      if (paragraph.section_id && paragraph.section_id !== previousSection) {
        children.push(docxHeading(sectionMap.get(paragraph.section_id) ?? 'Section', 2))
        previousSection = paragraph.section_id
      }
      const prefix = [timestamp(paragraph.start_seconds), paragraph.speaker].filter(Boolean).join(' · ')
      children.push(docxParagraph(`${prefix ? `${prefix}: ` : ''}${paragraph.body}`))
    }
    return buildStudyDocxResponse({ title: 'Reference Transcript', filename: `${baseName}.docx`, children })
  }

  const lines = ['REFERENCE TRANSCRIPT', source, '', transcript.disclaimer ?? '', '']
  for (const paragraph of paragraphs ?? []) {
    if (paragraph.section_id && paragraph.section_id !== previousSection) {
      lines.push('', String(sectionMap.get(paragraph.section_id) ?? 'Section').toUpperCase(), '')
      previousSection = paragraph.section_id
    }
    const prefix = [timestamp(paragraph.start_seconds), paragraph.speaker].filter(Boolean).join(' · ')
    lines.push(`${prefix ? `${prefix}: ` : ''}${paragraph.body}`)
  }
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${baseName}.txt"`, 'Cache-Control': 'no-store' } })
}
