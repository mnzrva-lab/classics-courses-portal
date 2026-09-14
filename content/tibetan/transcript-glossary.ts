import rawCourse8 from '@/content/classics/course-08/taiwan-2026.json'
import { course8Transcripts } from '@/content/classics/course-08/taiwan-2026/transcripts'
import rawLivingLamRim from '@/content/living-lam-rim/catalog.json'
import { livingLamRimTranscripts } from '@/content/living-lam-rim/transcripts'
import { perfectionGroups } from '@/content/perfection-of-wisdom/catalog'
import { perfectionTranscripts } from '@/content/perfection-of-wisdom/transcripts'

type GlossaryTerm = {
  term: string
  context: string
  source: string
  href: string
}

type Paragraph = { id: string; text: string }
type Chapter = { paragraphs: Paragraph[] }

type SourceEntry = {
  label: string
  hrefBase: string
  chapters: Chapter[]
}

const course8 = rawCourse8 as {
  offering: { label: string }
  sessions: Array<{ id: string; slug: string; label: string }>
}

const livingLamRim = rawLivingLamRim as {
  terms: Array<{ term: number; slug: string; sessions: Array<{ id: string; slug: string; label: string }> }>
}

const editorialMarkers = new Set([
  'applause', 'background noise', 'inaudible', 'laughter', 'laughs', 'music', 'pause', 'silence', 'unclear', 'unintelligible',
])

function cleanInline(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/\\([*_`~>#\[\]])/g, '$1')
    .replace(/[*_`~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isCandidate(value: string) {
  const term = cleanInline(value)
  if (term.length < 2 || term.length > 80) return false
  if (!/[A-Za-z]/.test(term)) return false
  if (term.split(/\s+/).length > 8) return false
  if (/https?:\/\/|www\.|[<>={}]/i.test(term)) return false
  if (/[.!?;:]$/.test(term)) return false
  if (editorialMarkers.has(term.toLowerCase())) return false
  return true
}

function contextAround(text: string, start: number, end: number) {
  const before = cleanInline(text.slice(0, start)).split(/\s+/).filter(Boolean)
  const middle = cleanInline(text.slice(start, end))
  const after = cleanInline(text.slice(end)).split(/\s+/).filter(Boolean)
  const words = [...before.slice(-11), middle, ...after.slice(0, 15)].filter(Boolean)
  const prefix = before.length > 11 ? '…' : ''
  const suffix = after.length > 15 ? '…' : ''
  return `${prefix}${words.join(' ')}${suffix}`
}

function sourceEntries(): SourceEntry[] {
  const entries: SourceEntry[] = []

  for (const session of course8.sessions) {
    const chapters = course8Transcripts[session.id]
    if (!chapters?.length) continue
    entries.push({
      label: `Classics Course 8 · ${session.label} · ${course8.offering.label}`,
      hrefBase: `/courses/course-8/taiwan-2026/${session.slug}`,
      chapters,
    })
  }

  for (const term of livingLamRim.terms) {
    for (const session of term.sessions) {
      const chapters = livingLamRimTranscripts[session.id]
      if (!chapters?.length) continue
      entries.push({
        label: `Living Lam Rim · Term ${term.term} · ${session.label}`,
        hrefBase: `/living-lam-rim/${term.slug}/${session.slug}`,
        chapters,
      })
    }
  }

  for (const group of perfectionGroups) {
    for (const session of group.sessions) {
      const chapters = perfectionTranscripts[session.id]
      if (!chapters?.length) continue
      entries.push({
        label: `Perfection of Wisdom · ${group.title} · ${session.name}`,
        hrefBase: `/perfection-of-wisdom/${group.slug}/${session.slug}`,
        chapters,
      })
    }
  }

  return entries
}

export function transcriptGlossaryTerms(): GlossaryTerm[] {
  const terms: GlossaryTerm[] = []
  const seen = new Set<string>()
  const bracketPattern = /\[([^\[\]\n]+)\]/g

  for (const source of sourceEntries()) {
    for (const chapter of source.chapters) {
      for (const paragraph of chapter.paragraphs) {
        for (const match of paragraph.text.matchAll(bracketPattern)) {
          const start = match.index ?? 0
          const end = start + match[0].length

          // Markdown links also use square brackets. Do not treat [label](url) as a Tibetan term.
          if (paragraph.text[end] === '(') continue

          const cleanedTerm = cleanInline(match[1] ?? '')
          if (!cleanedTerm || !isCandidate(cleanedTerm)) continue
          const normalized = cleanedTerm.toLocaleLowerCase()
          if (seen.has(normalized)) continue
          seen.add(normalized)

          terms.push({
            term: cleanedTerm,
            context: contextAround(paragraph.text, start, end),
            source: source.label,
            href: `${source.hrefBase}#${paragraph.id}`,
          })
        }
      }
    }
  }

  return terms.sort((a, b) => a.term.localeCompare(b.term))
}
