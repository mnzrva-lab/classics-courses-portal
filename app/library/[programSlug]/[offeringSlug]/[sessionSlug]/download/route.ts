import { getPublishedLibraryClass } from '@/lib/managed-library-content'
import { buildStudyDocxResponse, docxHeading, docxMeta, docxParagraph, docxTitle, docxTextBlocks } from '@/lib/study-docx'
import type { ManagedTranscriptParagraph } from '@/lib/managed-library-schema'

export const dynamic = 'force-dynamic'
type Params = { programSlug: string; offeringSlug: string; sessionSlug: string }

function timeLabel(seconds: number) {
  const n = Math.max(0, Math.floor(seconds))
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60
  const two = (v: number) => String(v).padStart(2, '0')
  return h ? two(h) + ':' + two(m) + ':' + two(s) : two(m) + ':' + two(s)
}
function printableParagraph(paragraph: ManagedTranscriptParagraph) {
  const time = typeof paragraph.startSeconds === 'number'
    ? (paragraph.timingSource === 'estimated' ? '~' : '') + '[' + timeLabel(paragraph.startSeconds) + '] '
    : ''
  const speaker = paragraph.speaker.trim() ? paragraph.speaker.trim() + ': ' : ''
  return time + speaker + paragraph.text
}
function cleanHeading(value: string) {
  return value.replace(/[*_\x60]/g, '').trim()
}
function txtResponse(content: string, filename: string) {
  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="' + filename + '.txt"',
      'Cache-Control': 'no-store',
    },
  })
}
export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  const { programSlug, offeringSlug, sessionSlug } = await params
  const { searchParams } = new URL(request.url)
  const content = searchParams.get('content')
  const format = searchParams.get('format')
  if ((content !== 'notes' && content !== 'transcript') ||
      (format !== 'txt' && format !== 'docx')) {
    return new Response('Invalid download request.', { status: 400 })
  }
  const record = await getPublishedLibraryClass(programSlug, offeringSlug, sessionSlug)
  if (!record) return new Response('Class not found.', { status: 404 })
  const { offering, session, transcript, studyNotes } = record
  const filename = [programSlug, offeringSlug, sessionSlug, content].join('-')
  const heading = offering.programTitle + ' · ' + session.title +
    (content === 'notes' ? ' · Study Notes' : ' · Reference Transcript')
  const meta = [offering.offeringLabel, session.date, session.teacher].filter(Boolean).join(' · ')

  if (content === 'notes') {
    if (!studyNotes) return new Response('Study Notes not found.', { status: 404 })
    if (format === 'txt') return txtResponse(heading + '\n' + meta + '\n\n' + studyNotes + '\n', filename)
    return buildStudyDocxResponse({
      title: heading, filename: filename + '.docx',
      children: [docxTitle(heading), docxMeta(meta), ...docxTextBlocks(studyNotes)],
    })
  }

  if (!transcript) return new Response('Transcript not found.', { status: 404 })
  const lines = [heading, meta, '']
  const timed = transcript.timingStatus === 'youtube-caption-aligned'
  if (timed) lines.push('YouTube-linked time markers. A ~ marks an estimated time.', '')
  const docx = [docxTitle(heading), docxMeta(meta)]
  if (timed) docx.push(docxMeta('YouTube-linked time markers. A ~ marks an estimated time.'))
  for (const chapter of transcript.chapters) {
    lines.push(chapter.title, '')
    docx.push(docxHeading(cleanHeading(chapter.title), 2))
    for (const paragraph of chapter.paragraphs) {
      const printed = printableParagraph(paragraph)
      lines.push(printed, '')
      docx.push(docxParagraph(printed))
    }
  }
  if (format === 'txt') return txtResponse(lines.join('\n').trim() + '\n', filename)
  return buildStudyDocxResponse({ title: heading, filename: filename + '.docx', children: docx })
}
