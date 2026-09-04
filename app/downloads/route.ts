import rawCourse8 from '@/content/classics/course-08/taiwan-2026.json'
import { course8StudyNotesForSession } from '@/content/classics/course-08/taiwan-2026/study-notes'
import { course8TranscriptForSession } from '@/content/classics/course-08/taiwan-2026/transcripts'
import rawLivingLamRim from '@/content/living-lam-rim/catalog.json'
import { livingLamRimTranscriptForSession } from '@/content/living-lam-rim/transcripts'
import { perfectionGroups, perfectionProgram } from '@/content/perfection-of-wisdom/catalog'
import { perfectionTranscriptForSession } from '@/content/perfection-of-wisdom/transcripts'
import { buildStudyDocxResponse, docxHeading, docxMeta, docxParagraph, docxTitle, docxTextBlocks } from '@/lib/study-docx'

type TranscriptParagraph = { speaker?: string; text: string }
type TranscriptChapter = { title: string; paragraphs: TranscriptParagraph[] }
type TranscriptBundle = { title: string; meta: string; filename: string; chapters: TranscriptChapter[] }
type NotesBundle = { title: string; meta: string; filename: string; summary: string; topics: string[]; markdown: string }

type Course8Data = {
  offering: { label: string }
  sessions: Array<{ id: string; label: string; date: string; teacher: string }>
}

type LivingLamRimData = {
  terms: Array<{
    term: number
    title: string | null
    sessions: Array<{ id: string; label: string; date: string; duration: string }>
  }>
}

const course8 = rawCourse8 as Course8Data
const livingLamRim = rawLivingLamRim as LivingLamRimData

function cleanMarkdown(value: string) {
  return String(value ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|\s)[*_](?=\S)|(?<=\S)[*_](?=\s|$)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
}

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'study-file'
}

function transcriptBundle(collection: string, sessionId: string): TranscriptBundle | null {
  if (collection === 'course8') {
    const session = course8.sessions.find((item) => item.id === sessionId)
    const chapters = course8TranscriptForSession(sessionId)
    if (!session || !chapters.length) return null
    return {
      title: `Classics Course 8 · ${session.label} · Reference Transcript`,
      meta: `${course8.offering.label} · ${session.date}${session.teacher ? ` · ${session.teacher}` : ''}`,
      filename: `${safeFilename(`course-8-${course8.offering.label}-${session.label}`)}-transcript`,
      chapters,
    }
  }

  if (collection === 'living-lam-rim') {
    for (const term of livingLamRim.terms) {
      const session = term.sessions.find((item) => item.id === sessionId)
      if (!session) continue
      const chapters = livingLamRimTranscriptForSession(sessionId)
      if (!chapters.length) return null
      return {
        title: `Living Lam Rim · Term ${term.term} · ${session.label} · Reference Transcript`,
        meta: `${term.title ?? `Term ${term.term}`} · ${session.date} · ${session.duration}`,
        filename: `${safeFilename(`living-lam-rim-term-${term.term}-${session.label}`)}-transcript`,
        chapters,
      }
    }
  }

  if (collection === 'perfection') {
    for (const group of perfectionGroups) {
      const session = group.sessions.find((item) => item.id === sessionId)
      if (!session) continue
      const chapters = perfectionTranscriptForSession(sessionId)
      if (!chapters.length) return null
      return {
        title: `${perfectionProgram.title} · ${session.name} · Reference Transcript`,
        meta: `${group.title} · ${session.date}${session.teacher ? ` · ${session.teacher}` : ''}`,
        filename: `${safeFilename(`perfection-of-wisdom-${session.name}`)}-transcript`,
        chapters,
      }
    }
  }

  return null
}

function notesBundle(collection: string, sessionId: string): NotesBundle | null {
  if (collection !== 'course8') return null
  const session = course8.sessions.find((item) => item.id === sessionId)
  const notes = course8StudyNotesForSession(sessionId)
  if (!session || !notes) return null
  return {
    title: `Classics Course 8 · ${session.label} · Study Notes`,
    meta: `${course8.offering.label} · ${session.date}${session.teacher ? ` · ${session.teacher}` : ''}`,
    filename: `${safeFilename(`course-8-${course8.offering.label}-${session.label}`)}-study-notes`,
    summary: notes.summary,
    topics: notes.topics,
    markdown: notes.markdown,
  }
}

function transcriptTxt(bundle: TranscriptBundle) {
  const lines: string[] = [bundle.title, bundle.meta, '']
  for (const chapter of bundle.chapters) {
    lines.push(cleanMarkdown(chapter.title), '')
    for (const paragraph of chapter.paragraphs) {
      const text = cleanMarkdown(paragraph.text)
      lines.push(paragraph.speaker ? `${paragraph.speaker}: ${text}` : text, '')
    }
  }
  return lines.join('\n').trim() + '\n'
}

function notesTxt(bundle: NotesBundle) {
  return [
    bundle.title,
    bundle.meta,
    '',
    'Summary',
    cleanMarkdown(bundle.summary),
    '',
    'Topics',
    ...bundle.topics.map((topic) => `- ${cleanMarkdown(topic)}`),
    '',
    'Full Study Notes',
    cleanMarkdown(bundle.markdown),
    '',
  ].join('\n')
}

function txtResponse(text: string, filename: string) {
  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.txt"`,
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const collection = searchParams.get('collection') ?? ''
  const sessionId = searchParams.get('session') ?? ''
  const content = searchParams.get('content') ?? ''
  const format = searchParams.get('format') ?? ''

  if (!collection || !sessionId || !['transcript', 'notes'].includes(content) || !['txt', 'docx'].includes(format)) {
    return new Response('Invalid download request.', { status: 400 })
  }

  if (content === 'transcript') {
    const bundle = transcriptBundle(collection, sessionId)
    if (!bundle) return new Response('Transcript not found.', { status: 404 })
    if (format === 'txt') return txtResponse(transcriptTxt(bundle), bundle.filename)

    const children = [docxTitle(bundle.title), docxMeta(bundle.meta)]
    for (const chapter of bundle.chapters) {
      children.push(docxHeading(cleanMarkdown(chapter.title), 2))
      for (const paragraph of chapter.paragraphs) {
        const text = cleanMarkdown(paragraph.text)
        children.push(docxParagraph(paragraph.speaker ? `${paragraph.speaker}: ${text}` : text))
      }
    }
    return buildStudyDocxResponse({ title: bundle.title, filename: `${bundle.filename}.docx`, children })
  }

  const notes = notesBundle(collection, sessionId)
  if (!notes) return new Response('Study Notes not found.', { status: 404 })
  if (format === 'txt') return txtResponse(notesTxt(notes), notes.filename)

  const children = [
    docxTitle(notes.title),
    docxMeta(notes.meta),
    docxHeading('Summary', 2),
    docxParagraph(cleanMarkdown(notes.summary)),
    docxHeading('Topics', 2),
    ...notes.topics.map((topic) => docxParagraph(`• ${cleanMarkdown(topic)}`)),
    docxHeading('Full Study Notes', 2),
    ...docxTextBlocks(cleanMarkdown(notes.markdown)),
  ]
  return buildStudyDocxResponse({ title: notes.title, filename: `${notes.filename}.docx`, children })
}
