import Link from 'next/link'
import CopyReference from '@/components/copy-reference'
import rawCatalog from '@/content/classics/catalog.json'
import rawCourseData from '@/content/classics/course-08/taiwan-2026.json'
import { allArchiveSessions } from '@/content/classics/archive-sessions'
import { archiveSessionSlug } from '@/content/classics/archive-route'
import { course8StudyNotes } from '@/content/classics/course-08/taiwan-2026/study-notes'
import { course8Transcripts } from '@/content/classics/course-08/taiwan-2026/transcripts'
import rawLamRimCatalog from '@/content/living-lam-rim/catalog.json'
import { livingLamRimTranscripts } from '@/content/living-lam-rim/transcripts'
import { perfectionGroups, perfectionProgram } from '@/content/perfection-of-wisdom/catalog'
import { perfectionTranscripts } from '@/content/perfection-of-wisdom/transcripts'

type CanonicalCourse = { canonicalNumber: number; slug: string; title: string }
type CourseSession = { id: string; slug: string; label: string; kind: string; teacher: string }
type CourseData = {
  course: { canonicalNumber: number; slug: string; title: string }
  offering: { slug: string; label: string }
  sessions: CourseSession[]
}
type LamRimSession = { id: string; slug: string; label: string; kind: string }
type LamRimTerm = { term: number; slug: string; title: string | null; sessions: LamRimSession[] }
type LamRimCatalog = { program: { slug: string; title: string }; terms: LamRimTerm[] }
type SearchResult = {
  id: string
  sourceId: string
  sourceLabel: string
  contextLabel: string
  sessionLabel: string
  sessionKind: string
  teacher: string
  contentType: 'Transcript' | 'Study Notes' | 'Recording'
  chapter?: string
  speaker?: string
  body: string
  href: string
  score: number
  reference: string
}

const classicsCatalog = rawCatalog as CanonicalCourse[]
const classicsByNumber = new Map(classicsCatalog.map((course) => [course.canonicalNumber, course]))
const courseData = rawCourseData as CourseData
const lamRimCatalog = rawLamRimCatalog as LamRimCatalog
const course8Sessions = new Map(courseData.sessions.map((session) => [session.id, session]))
const lamRimSessionIndex = new Map<string, { term: LamRimTerm; session: LamRimSession }>()
for (const term of lamRimCatalog.terms) for (const session of term.sessions) lamRimSessionIndex.set(session.id, { term, session })
const perfectionSessionIndex = new Map(perfectionGroups.flatMap((group) => group.sessions.map((session) => [session.id, { group, session }] as const)))

function clip(text: string, length = 320) {
  const cleaned = text.replace(/\s+/g, ' ').replace(/[*_`]/g, '').trim()
  return cleaned.length > length ? `${cleaned.slice(0, length).trim()}…` : cleaned
}
function normalize(value: string) { return value.toLocaleLowerCase().replace(/[“”‘’]/g, "'").replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim() }
function searchScore(text: string, query: string) {
  const haystack = normalize(text)
  const phrase = normalize(query)
  const terms = phrase.split(' ').filter(Boolean)
  if (!terms.length || !terms.every((term) => haystack.includes(term))) return 0
  let score = haystack.includes(phrase) ? 50 : 0
  for (const term of terms) {
    let index = 0
    while ((index = haystack.indexOf(term, index)) !== -1) { score += 1; index += term.length }
  }
  return score
}
function studyNoteSections(markdown: string) {
  const sections: Array<{ title: string; body: string }> = []
  let title = 'Study Notes'; let lines: string[] = []
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      if (lines.join(' ').trim()) sections.push({ title, body: lines.join('\n').trim() })
      title = heading[1].replace(/[*_`]/g, '').trim(); lines = []
    } else lines.push(line)
  }
  if (lines.join(' ').trim()) sections.push({ title, body: lines.join('\n').trim() })
  return sections
}
function perfectionKind(name: string) {
  const normalized = name.toLowerCase()
  if (normalized.includes('q and a') || normalized.includes('qa ')) return 'Q&A'
  if (normalized.includes('yoga')) return 'Yoga'
  if (normalized.includes('translation class')) return 'Translation'
  return 'Class'
}
function archiveKind(code: string, name: string) {
  const normalized = `${code} ${name}`.toLowerCase()
  if (normalized.includes('meditation') || /^m\d*\b/.test(normalized)) return 'Meditation'
  if (normalized.includes('q&a') || normalized.includes('q and a') || normalized.includes('roundtable')) return 'Q&A'
  if (normalized.includes('review') || /^r\b/.test(normalized)) return 'Review'
  return 'Class'
}

function buildResults(query: string) {
  if (!query) return [] as SearchResult[]
  const results: SearchResult[] = []

  for (const item of allArchiveSessions()) {
    const course = classicsByNumber.get(item.courseNumber)
    if (!course) continue
    const searchable = [
      `Course ${course.canonicalNumber}`,
      course.title,
      item.offeringLabel,
      item.code,
      item.name,
      item.teacher,
      item.date,
      item.sourceTitle,
    ].filter(Boolean).join('\n')
    const score = searchScore(searchable, query)
    if (!score) continue
    const href = `/archive/classics/${course.slug}/${item.offeringSlug}/${archiveSessionSlug(item)}`
    const teacher = item.teacher ?? ''
    const details = [item.sourceTitle || item.name, teacher, item.date, item.duration].filter(Boolean).join(' · ')
    results.push({
      id: `${item.courseNumber}-${item.offeringSlug}-${item.videoId ?? item.url}`,
      sourceId: course.slug,
      sourceLabel: `Classics Course ${course.canonicalNumber} · ${course.title}`,
      contextLabel: item.offeringLabel,
      sessionLabel: `${item.code} · ${item.name}`,
      sessionKind: archiveKind(item.code, item.name),
      teacher,
      contentType: 'Recording',
      body: details,
      href,
      score,
      reference: `Course ${course.canonicalNumber} · ${item.offeringLabel} · ${item.code} · Recording`,
    })
  }

  for (const [sessionId, chapters] of Object.entries(course8Transcripts)) {
    const session = course8Sessions.get(sessionId); if (!session) continue
    for (const chapter of chapters) for (const paragraph of chapter.paragraphs) {
      const score = searchScore(`${chapter.title}\n${paragraph.speaker}\n${paragraph.text}`, query); if (!score) continue
      const href = `/courses/course-8/taiwan-2026/${session.slug}#${paragraph.id}`
      results.push({ id: paragraph.id, sourceId: courseData.course.slug, sourceLabel: `Classics Course ${courseData.course.canonicalNumber} · ${courseData.course.title}`, contextLabel: courseData.offering.label, sessionLabel: session.label, sessionKind: session.kind, teacher: session.teacher, contentType: 'Transcript', chapter: chapter.title, speaker: paragraph.speaker, body: paragraph.text, href, score: score + 5, reference: `Course ${courseData.course.canonicalNumber} · ${courseData.offering.label} · ${session.label} · Transcript` })
    }
  }

  for (const [sessionId, notes] of Object.entries(course8StudyNotes)) {
    const session = course8Sessions.get(sessionId); if (!session) continue
    studyNoteSections(notes.markdown).forEach((section, index) => {
      const score = searchScore(`${section.title}\n${section.body}`, query); if (!score) return
      const href = `/courses/course-8/taiwan-2026/${session.slug}#study-notes`
      results.push({ id: `${sessionId}-notes-${index + 1}`, sourceId: courseData.course.slug, sourceLabel: `Classics Course ${courseData.course.canonicalNumber} · ${courseData.course.title}`, contextLabel: courseData.offering.label, sessionLabel: session.label, sessionKind: session.kind, teacher: session.teacher, contentType: 'Study Notes', chapter: section.title, body: section.body.replace(/^[-*]\s+/gm, ''), href, score: score + 3, reference: `Course ${courseData.course.canonicalNumber} · ${courseData.offering.label} · ${session.label} · Study Notes` })
    })
  }

  for (const [sessionId, chapters] of Object.entries(livingLamRimTranscripts)) {
    const entry = lamRimSessionIndex.get(sessionId); if (!entry) continue
    const { term, session } = entry
    for (const chapter of chapters) for (const paragraph of chapter.paragraphs) {
      const score = searchScore(`${chapter.title}\n${paragraph.speaker}\n${paragraph.text}`, query); if (!score) continue
      const href = `/living-lam-rim/${term.slug}/${session.slug}#${paragraph.id}`
      const termLabel = `Term ${term.term}${term.title ? ` · ${term.title}` : ''}`
      results.push({ id: paragraph.id, sourceId: lamRimCatalog.program.slug, sourceLabel: lamRimCatalog.program.title, contextLabel: termLabel, sessionLabel: session.label, sessionKind: session.kind, teacher: 'Timothy Lowenhaupt', contentType: 'Transcript', chapter: chapter.title, speaker: paragraph.speaker, body: paragraph.text, href, score: score + 5, reference: `${lamRimCatalog.program.title} · ${termLabel} · ${session.label} · Transcript` })
    }
  }

  for (const [sessionId, chapters] of Object.entries(perfectionTranscripts)) {
    const entry = perfectionSessionIndex.get(sessionId); if (!entry) continue
    const { group, session } = entry
    for (const chapter of chapters) for (const paragraph of chapter.paragraphs) {
      const score = searchScore(`${chapter.title}\n${paragraph.speaker}\n${paragraph.text}`, query); if (!score) continue
      const href = `/perfection-of-wisdom/${group.slug}/${session.slug}#${paragraph.id}`
      results.push({ id: paragraph.id, sourceId: perfectionProgram.slug, sourceLabel: perfectionProgram.title, contextLabel: group.title, sessionLabel: session.name, sessionKind: perfectionKind(session.name), teacher: session.teacher, contentType: 'Transcript', chapter: chapter.title.replace(/[*_`]/g, ''), speaker: paragraph.speaker, body: paragraph.text, href, score: score + 5, reference: `${perfectionProgram.title} · ${group.title} · ${session.code} · Transcript` })
    }
  }

  return results.sort((a, b) => b.score - a.score || a.sourceLabel.localeCompare(b.sourceLabel)).slice(0, 150)
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; course?: string; teacher?: string; type?: string }> }) {
  const params = await searchParams
  const query = (params.q ?? '').trim(); const courseFilter = (params.course ?? '').trim(); const teacherFilter = (params.teacher ?? '').trim(); const typeFilter = (params.type ?? '').trim()
  const rawResults = buildResults(query)
  const results = rawResults.filter((result) => (!courseFilter || result.sourceId === courseFilter) && (!teacherFilter || result.teacher === teacherFilter) && (!typeFilter || result.sessionKind === typeFilter))
  const courseOptions = Array.from(new Map(rawResults.map((result) => [result.sourceId, result.sourceLabel] as const))).sort((a, b) => a[1].localeCompare(b[1]))
  const teacherOptions = Array.from(new Set(rawResults.map((result) => result.teacher).filter(Boolean))).sort()
  const typeOptions = Array.from(new Set(rawResults.map((result) => result.sessionKind).filter(Boolean))).sort()
  const advancedActive = Boolean(courseFilter || teacherFilter || typeFilter)

  return <main className="container page search-page-simple">
    <div className="eyebrow">Search</div><h1>Search the teachings</h1>
    <form className="search-primary" action="/search" method="get"><span aria-hidden="true">⌕</span><input type="search" name="q" defaultValue={query} autoFocus placeholder="Search recordings, Study Notes and transcripts…" aria-label="Search recordings, Study Notes and transcripts" /><button type="submit">Search</button></form>
    <p className="meta search-privacy">Search runs across the public teaching archive. Search history is not saved in this version.</p>
    {query ? <>
      <details className="advanced-search" open={advancedActive}><summary>Advanced search</summary><form action="/search" method="get" className="advanced-search-form">
        <input type="hidden" name="q" value={query} />
        <label>Archive<select name="course" defaultValue={courseFilter}><option value="">All available archives</option>{courseOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Teacher<select name="teacher" defaultValue={teacherFilter}><option value="">All teachers</option>{teacherOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Session type<select name="type" defaultValue={typeFilter}><option value="">All session types</option>{typeOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <div className="actions"><button className="button sage" type="submit">Apply filters</button>{advancedActive ? <Link className="button" href={`/search?q=${encodeURIComponent(query)}`}>Clear filters</Link> : null}</div>
      </form></details>
      <section className="section search-results-simple"><div className="section-head"><div><h2>{results.length} result{results.length === 1 ? '' : 's'} for “{query}”</h2></div></div>
        {results.length ? results.map((result) => <article className="search-result-row" key={`${result.sourceId}-${result.contentType}-${result.id}`}>
          <div className="meta">{result.sourceLabel} · {result.contextLabel} · {result.sessionLabel} · {result.contentType}{result.chapter ? ` · ${result.chapter}` : ''}</div>
          <div className="search-result-copy">{result.speaker ? <strong>{result.speaker}: </strong> : null}{clip(result.body)}</div>
          <div className="actions"><Link className="button" href={result.href}>Open {result.contentType === 'Transcript' ? 'passage' : result.contentType === 'Study Notes' ? 'Study Notes' : 'recording'}</Link><CopyReference reference={result.reference} path={result.href} /></div>
        </article>) : <p className="meta">No teaching material matched this search.</p>}
      </section>
    </> : <section className="section search-empty"><p className="meta">Search includes the migrated Classics recording archives, Course 8 Study Notes and transcripts, Living Lam Rim transcripts, and Perfection of Wisdom transcripts. More transcript text will appear as it is added to the Library.</p></section>}
  </main>
}
