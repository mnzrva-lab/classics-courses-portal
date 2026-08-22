'use client'

import { ChangeEvent, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { applyArchiveBatches, type ArchiveBatchInput } from './actions'

type Course = { id: string; kind: string; canonical_number: number | null; title: string; status: string }
type Teacher = { id: string; full_name: string; active: boolean }
type Offering = { id: string; course_id: string; label: string; status: string; year: number | null; location: string | null }
type ExistingSession = { id: string; offering_id: string; code: string | null; title: string; session_type: string; status: string; sort_order: number }
type ExistingGroup = { id: string; offering_id: string; kind: string; label: string; status: string; sort_order: number }
type SortMode = 'class' | 'date'

type ImportRow = {
  key: string
  include: boolean
  rawTitle: string
  videoUrl: string
  position: number
  code: string
  title: string
  sessionType: string
  sessionDate: string
  teacherIds: string[]
  status: string
  warning: string | null
  sessionId: string
}

type ImportBatch = {
  key: string
  fileName: string
  playlistTitle: string
  playlistUrl: string
  courseId: string
  offeringId: string
  offeringLabel: string
  location: string
  year: string
  languages: string
  offeringStatus: string
  groupKind: string
  groupLabel: string
  sortMode: SortMode
  rows: ImportRow[]
}

const sessionTypes = [
  ['class', 'Class'],
  ['meditation', 'Meditation'],
  ['review', 'Review'],
  ['qna', 'Q&A'],
  ['vows', 'Vows'],
  ['other', 'Other'],
]

const typeRank: Record<string, number> = {
  class: 0,
  meditation: 1,
  review: 2,
  qna: 3,
  vows: 4,
  other: 5,
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (char === '"') {
      if (quoted && next === '"') { field += '"'; i += 1 } else quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) { row.push(field); field = ''; continue }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1
      row.push(field)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      field = ''
      continue
    }
    field += char
  }
  row.push(field)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

function csvObjects(text: string) {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('CSV has no video rows.')
  const headers = rows[0].map((value) => value.trim().toLowerCase())
  const index = new Map(headers.map((header, position) => [header, position]))
  const get = (row: string[], name: string) => row[index.get(name.toLowerCase()) ?? -1]?.trim() ?? ''
  if (!index.has('video title') || !index.has('video url')) throw new Error('CSV needs Video Title and Video URL columns.')
  return rows.slice(1).map((row, rowIndex) => ({
    position: Number.isFinite(Number(get(row, 'Position'))) ? Number(get(row, 'Position')) : rowIndex,
    playlistTitle: get(row, 'Playlist Title'),
    playlistUrl: get(row, 'Playlist URL'),
    videoTitle: get(row, 'Video Title'),
    videoUrl: get(row, 'Video URL'),
    publishDate: get(row, 'Video Publish Date'),
    availability: get(row, 'Availability Status'),
  })).filter((row) => row.videoUrl && (!row.availability || row.availability.toLowerCase() === 'available'))
}

function chineseNumber(value: string) {
  const digits: Record<string, number> = { '零': 0, '〇': 0, '一': 1, '二': 2, '兩': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 }
  if (/^\d+$/.test(value)) return Number(value)
  if (value === '十') return 10
  if (value.includes('十')) {
    const [left, right] = value.split('十')
    return (left ? digits[left] ?? 0 : 1) * 10 + (right ? digits[right] ?? 0 : 0)
  }
  return digits[value] ?? null
}

function sessionNumber(title: string, kind: string) {
  const lower = title.toLowerCase()
  const patterns = kind === 'meditation'
    ? [/\bmeditation\s*0*(\d+)\b/i]
    : kind === 'review'
      ? [/\breview\s*class\s*0*(\d+)\b/i]
      : kind === 'qna'
        ? [/\b(?:q&a|roundtable)\s*0*(\d+)\b/i]
        : [/\bclass\s*0*(\d+)\b/i]
  for (const pattern of patterns) {
    const match = title.match(pattern)
    if (match) return Number(match[1])
  }
  if (kind === 'class') {
    const chinese = title.match(/第\s*([0-9一二三四五六七八九十兩两〇零]+)\s*(?:課|课|講|讲|場|场)/)
    if (chinese) return chineseNumber(chinese[1])
  }
  if (lower.includes('final class')) return null
  return null
}

function sessionKind(title: string) {
  const lower = title.toLowerCase()
  if (/\breview\s*class\b/.test(lower)) return 'review'
  if (lower.includes('q&a') || lower.includes('roundtable')) return 'qna'
  if (lower.includes('meditation') && !/\bclass\s*\d+\b/.test(lower)) return 'meditation'
  if (lower.includes('vow')) return 'vows'
  return 'class'
}

function isoDateFromTitle(title: string) {
  const months: Record<string, number> = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 }
  const english = title.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(20\d{2})\b/i)
  if (english) {
    const month = months[english[1].toLowerCase()]
    if (month) return `${english[3]}-${String(month).padStart(2, '0')}-${String(Number(english[2])).padStart(2, '0')}`
  }
  const chinese = title.match(/(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (chinese) return `${chinese[1]}-${String(Number(chinese[2])).padStart(2, '0')}-${String(Number(chinese[3])).padStart(2, '0')}`
  return ''
}

function isoDateFromPublishDate(value: string) {
  const match = value.trim().match(/^(20\d{2})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : ''
}

function normalizeTeacherText(value: string) {
  return value.toLowerCase().replace(/mendosa/g, 'mendoza').replace(/briney/g, 'birney').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function matchedTeachers(title: string, teachers: Teacher[]) {
  const source = normalizeTeacherText(title)
  return teachers.filter((teacher) => {
    const full = normalizeTeacherText(teacher.full_name)
    const parts = full.split(' ').filter(Boolean)
    const first = parts[0] ?? ''
    const last = parts[parts.length - 1] ?? ''
    if (full && source.includes(full)) return true
    if (last.length >= 5 && source.includes(last)) return true
    if (teacher.full_name.toLowerCase().includes('timothy lowenhaupt') && source.includes('tim lowenhaupt')) return true
    if (parts.length === 1 && first.length >= 4 && source.includes(first)) return true
    return false
  }).map((teacher) => teacher.id)
}

function detectCourseNumber(fileName: string, playlistTitle: string, videoTitles: string[]) {
  const source = [fileName, playlistTitle, ...videoTitles.slice(0, 4)].join(' ')
  const match = source.match(/\bACI\s*([1-9]|1[0-8])\b/i)
  return match ? Number(match[1]) : null
}

function detectLocation(fileName: string, playlistTitle: string) {
  const source = `${fileName} ${playlistTitle}`.toLowerCase()
  if (source.includes('arizona') || /(^|\W)az(\W|$)/i.test(source)) return 'Arizona'
  if (source.includes('kyoto')) return 'Kyoto'
  if (source.includes('taiwan') || /(^|\W)(tw|tch|tcn|cn)(\W|$)/i.test(source)) return 'Taiwan'
  return ''
}

function detectYear(rows: ReturnType<typeof csvObjects>) {
  const years: number[] = []
  for (const row of rows) {
    const titleYear = row.videoTitle.match(/\b(20\d{2})\b/)?.[1]
    const publishYear = row.publishDate.match(/^(20\d{2})/)?.[1]
    const year = Number(titleYear || publishYear || 0)
    if (year) years.push(year)
  }
  if (!years.length) return ''
  const counts = new Map<number, number>()
  for (const year of years) counts.set(year, (counts.get(year) ?? 0) + 1)
  return String([...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0])
}

function defaultLanguages(fileName: string, playlistTitle: string) {
  const source = `${fileName} ${playlistTitle}`.toLowerCase()
  if (/\b(tch|tcn|cn)\b/.test(source) || source.includes('chinese')) return 'en, zh'
  return 'en'
}

function normalizedRowTitle(kind: string, number: number | null, rawTitle: string) {
  if (kind === 'meditation') return number ? `Meditation ${number}` : 'Meditation'
  if (kind === 'review') return number ? `Review Class ${number}` : 'Review'
  if (kind === 'qna') return number ? `Q&A ${number}` : 'Q&A'
  if (kind === 'vows') return 'Vows'
  if (kind === 'class' && number) return `Class ${number}`
  return rawTitle
}

function codeNumber(row: ImportRow) {
  const match = row.code.match(/(\d+)/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function compareClassOrder(a: ImportRow, b: ImportRow) {
  const typeDifference = (typeRank[a.sessionType] ?? 99) - (typeRank[b.sessionType] ?? 99)
  if (typeDifference) return typeDifference
  const numberDifference = codeNumber(a) - codeNumber(b)
  if (numberDifference) return numberDifference
  if (a.sessionDate && b.sessionDate && a.sessionDate !== b.sessionDate) return a.sessionDate.localeCompare(b.sessionDate)
  return a.position - b.position
}

function sortImportRows(rows: ImportRow[], mode: SortMode) {
  const copy = [...rows]
  if (mode === 'date') {
    return copy.sort((a, b) => {
      if (a.sessionDate && b.sessionDate && a.sessionDate !== b.sessionDate) return a.sessionDate.localeCompare(b.sessionDate)
      if (a.sessionDate && !b.sessionDate) return -1
      if (!a.sessionDate && b.sessionDate) return 1
      return compareClassOrder(a, b)
    })
  }
  return copy.sort(compareClassOrder)
}

function initialRows(raw: ReturnType<typeof csvObjects>, teachers: Teacher[]) {
  const rows = [...raw].sort((a, b) => a.position - b.position).map((row, index): ImportRow => {
    const kind = sessionKind(row.videoTitle)
    const number = sessionNumber(row.videoTitle, kind)
    const hasClass = /\bclass\s*\d+\b/i.test(row.videoTitle)
    const hasMeditation = /\bmeditation\b/i.test(row.videoTitle)
    const warning = hasClass && hasMeditation
      ? 'This recording title contains both a class and a meditation. Review the session type.'
      : kind === 'class' && number == null
        ? 'Class number was not explicit. Review the code/title.'
        : null
    const prefix = kind === 'meditation' ? 'M' : kind === 'review' ? 'R' : kind === 'qna' ? 'Q' : kind === 'vows' ? 'V' : 'C'
    return {
      key: `${index}:${row.videoUrl}`,
      include: true,
      rawTitle: row.videoTitle,
      videoUrl: row.videoUrl,
      position: row.position,
      code: number ? `${prefix}${number}` : '',
      title: normalizedRowTitle(kind, number, row.videoTitle),
      sessionType: kind,
      sessionDate: isoDateFromPublishDate(row.publishDate) || isoDateFromTitle(row.videoTitle),
      teacherIds: matchedTeachers(row.videoTitle, teachers),
      status: 'published',
      warning,
      sessionId: '',
    }
  })

  const usedCodes = new Set(rows.map((row) => row.code).filter(Boolean))
  const counters: Record<string, number> = { class: 1, meditation: 1, review: 1, qna: 1, vows: 1, other: 1 }
  for (const row of rows) {
    if (row.code) continue
    const prefix = row.sessionType === 'meditation' ? 'M' : row.sessionType === 'review' ? 'R' : row.sessionType === 'qna' ? 'Q' : row.sessionType === 'vows' ? 'V' : 'C'
    let candidate = `${prefix}${counters[row.sessionType]++}`
    while (usedCodes.has(candidate)) candidate = `${prefix}${counters[row.sessionType]++}`
    row.code = candidate
    if (row.sessionType === 'class' && row.title === row.rawTitle) row.title = `Class ${candidate.slice(1)}`
    if (row.sessionType === 'meditation' && row.title === 'Meditation') row.title = `Meditation ${candidate.slice(1)}`
    usedCodes.add(candidate)
  }

  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.code, (counts.get(row.code) ?? 0) + 1)
  return rows.map((row) => counts.get(row.code)! > 1 ? { ...row, warning: row.warning || `Duplicate code ${row.code}. Rename one of these rows if they are separate sessions.` } : row)
}

function batchPayload(batch: ImportBatch): ArchiveBatchInput {
  return {
    key: batch.key,
    courseId: batch.courseId,
    offeringId: batch.offeringId || null,
    offeringLabel: batch.offeringLabel,
    location: batch.location || null,
    year: batch.year ? Number(batch.year) : null,
    languages: batch.languages.split(',').map((item) => item.trim()).filter(Boolean),
    offeringStatus: batch.offeringStatus,
    playlistTitle: batch.playlistTitle,
    playlistUrl: batch.playlistUrl,
    groupKind: batch.groupLabel.trim() ? batch.groupKind : null,
    groupLabel: batch.groupLabel.trim() || null,
    sessions: batch.rows.filter((row) => row.include).map((row, index) => ({
      sessionId: row.sessionId || null,
      code: row.code,
      title: row.title,
      sessionType: row.sessionType,
      sessionDate: row.sessionDate || null,
      recordingUrl: row.videoUrl,
      teacherIds: row.teacherIds,
      status: row.status,
      sortOrder: index,
    })),
  }
}

export default function ArchiveImportClient({
  courses,
  teachers,
  offerings,
  sessions,
  groups,
}: {
  courses: Course[]
  teachers: Teacher[]
  offerings: Offering[]
  sessions: ExistingSession[]
  groups: ExistingGroup[]
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses])
  const teacherMap = useMemo(() => new Map(teachers.map((teacher) => [teacher.id, teacher.full_name])), [teachers])

  async function readFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    setMessage(null)
    const next: ImportBatch[] = []

    for (const file of files) {
      try {
        const raw = csvObjects(await file.text())
        if (!raw.length) throw new Error('No available videos found.')
        const playlistTitle = raw.find((row) => row.playlistTitle)?.playlistTitle ?? file.name.replace(/\.csv$/i, '')
        const playlistUrl = raw.find((row) => row.playlistUrl)?.playlistUrl ?? ''
        const detectedNumber = detectCourseNumber(file.name, playlistTitle, raw.map((row) => row.videoTitle))
        const course = detectedNumber ? courses.find((item) => item.canonical_number === detectedNumber) : null
        const location = detectLocation(file.name, playlistTitle)
        const year = detectYear(raw)
        const label = [location, year].filter(Boolean).join(' ') || playlistTitle
        const sortMode: SortMode = course?.kind === 'classics' ? 'class' : 'date'
        const rows = sortImportRows(initialRows(raw, teachers), sortMode)
        next.push({
          key: `${file.name}:${crypto.randomUUID()}`,
          fileName: file.name,
          playlistTitle,
          playlistUrl,
          courseId: course?.id ?? '',
          offeringId: '',
          offeringLabel: label,
          location,
          year,
          languages: defaultLanguages(file.name, playlistTitle),
          offeringStatus: 'draft',
          groupKind: course?.kind === 'living_lam_rim' ? 'term' : course?.kind === 'book' ? 'part' : 'module',
          groupLabel: '',
          sortMode,
          rows,
        })
      } catch (error) {
        next.push({
          key: `${file.name}:${crypto.randomUUID()}`,
          fileName: file.name,
          playlistTitle: 'Could not parse this file',
          playlistUrl: '',
          courseId: '',
          offeringId: '',
          offeringLabel: '',
          location: '',
          year: '',
          languages: 'en',
          offeringStatus: 'draft',
          groupKind: 'module',
          groupLabel: '',
          sortMode: 'class',
          rows: [],
        })
        setMessage(error instanceof Error ? `${file.name}: ${error.message}` : `${file.name}: could not read file.`)
      }
    }

    setBatches((current) => [...current, ...next])
    event.target.value = ''
  }

  function updateBatch(key: string, patch: Partial<ImportBatch>) {
    setBatches((current) => current.map((batch) => batch.key === key ? { ...batch, ...patch } : batch))
  }

  function updateRow(batchKey: string, rowKey: string, patch: Partial<ImportRow>) {
    setBatches((current) => current.map((batch) => batch.key === batchKey ? {
      ...batch,
      rows: batch.rows.map((row) => row.key === rowKey ? { ...row, ...patch } : row),
    } : batch))
  }

  function setBatchCourse(batch: ImportBatch, courseId: string) {
    const course = courseMap.get(courseId)
    const sortMode: SortMode = course?.kind === 'classics' ? 'class' : 'date'
    updateBatch(batch.key, {
      courseId,
      offeringId: '',
      groupKind: course?.kind === 'living_lam_rim' ? 'term' : course?.kind === 'book' ? 'part' : 'module',
      sortMode,
      rows: sortImportRows(batch.rows, sortMode),
    })
  }

  function setExistingOffering(batch: ImportBatch, offeringId: string) {
    const offering = offerings.find((item) => item.id === offeringId)
    const matchingSessions = sessions.filter((session) => session.offering_id === offeringId)
    updateBatch(batch.key, {
      offeringId,
      offeringLabel: offering?.label ?? batch.offeringLabel,
      location: offering?.location ?? batch.location,
      year: offering?.year ? String(offering.year) : batch.year,
      rows: batch.rows.map((row) => {
        const match = matchingSessions.find((session) => session.code && row.code && session.code.toLowerCase() === row.code.toLowerCase())
        return match ? { ...row, sessionId: match.id, warning: row.warning || `Will update existing ${match.code}.` } : row
      }),
    })
  }

  function sortBatchRows(batchKey: string, mode: SortMode) {
    setBatches((current) => current.map((batch) => batch.key === batchKey ? {
      ...batch,
      sortMode: mode,
      rows: sortImportRows(batch.rows, mode),
    } : batch))
  }

  function applyStatus(batchKey: string, status: string) {
    setBatches((current) => current.map((batch) => batch.key === batchKey ? { ...batch, rows: batch.rows.map((row) => row.include ? { ...row, status } : row) } : batch))
  }

  function addTeacherToAll(batchKey: string, teacherId: string) {
    if (!teacherId) return
    setBatches((current) => current.map((batch) => batch.key === batchKey ? {
      ...batch,
      rows: batch.rows.map((row) => row.include ? { ...row, teacherIds: Array.from(new Set([...row.teacherIds, teacherId])) } : row),
    } : batch))
  }

  async function applyAll() {
    if (busy || !batches.length) return
    const invalid = batches.find((batch) => !batch.courseId || (!batch.offeringId && !batch.offeringLabel.trim()) || !batch.rows.some((row) => row.include))
    if (invalid) {
      setMessage(`Finish the course/offering settings for ${invalid.fileName} before importing.`)
      return
    }

    const queue = [...batches]
    let completed = 0
    setBusy(true)

    try {
      for (let index = 0; index < queue.length; index += 1) {
        const batch = queue[index]
        setMessage(`Importing ${index + 1} of ${queue.length}: ${batch.fileName}…`)
        const result = await applyArchiveBatches([batchPayload(batch)])
        if (!result.ok) throw new Error(`${batch.fileName}: ${result.message}`)
        completed += 1
        setBatches((current) => current.filter((item) => item.key !== batch.key))
      }
      setMessage(`Imported ${completed} CSV file${completed === 1 ? '' : 's'} successfully.`)
      router.refresh()
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Archive import failed.'
      setMessage(`${detail}${completed ? ` ${completed} earlier CSV file${completed === 1 ? '' : 's'} finished successfully and will not be repeated.` : ''}`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section archive-import-workspace">
      <div className="archive-import-toolbar">
        <div>
          <div className="eyebrow">1 · Add CSV files</div>
          <strong>One playlist export per Course Offering or program section</strong>
          <p className="meta">Video Publish Date is used as the session date when available. For a new Course Offering, the earliest and latest imported session dates become the offering start and end dates. Nothing is written until you review and click Import.</p>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" multiple hidden onChange={readFiles} />
        <button className="button red" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>+ Choose CSV files</button>
      </div>

      {batches.map((batch, batchIndex) => {
        const course = courseMap.get(batch.courseId)
        const availableOfferings = offerings.filter((offering) => offering.course_id === batch.courseId)
        const existingGroups = batch.offeringId ? groups.filter((group) => group.offering_id === batch.offeringId) : []
        const warnings = batch.rows.filter((row) => row.warning).length
        return (
          <article className="archive-batch" key={batch.key}>
            <header className="archive-batch-head">
              <div>
                <div className="eyebrow">CSV {batchIndex + 1}</div>
                <h2>{batch.fileName}</h2>
                <p className="meta">{batch.playlistTitle} · {batch.rows.length} videos{warnings ? ` · ${warnings} need review` : ''}</p>
              </div>
              <button className="button" type="button" onClick={() => setBatches((current) => current.filter((item) => item.key !== batch.key))}>Remove</button>
            </header>

            <div className="archive-batch-settings">
              <label>Course
                <select className="input" value={batch.courseId} onChange={(event) => setBatchCourse(batch, event.target.value)}>
                  <option value="">Choose course/program</option>
                  {courses.map((item) => <option key={item.id} value={item.id}>{item.canonical_number ? `Classics Course ${item.canonical_number} · ` : ''}{item.title}</option>)}
                </select>
              </label>
              <label>Import destination
                <select className="input" value={batch.offeringId} disabled={!batch.courseId} onChange={(event) => setExistingOffering(batch, event.target.value)}>
                  <option value="">Create new Course Offering</option>
                  {availableOfferings.map((offering) => <option key={offering.id} value={offering.id}>{offering.label} · {offering.status}</option>)}
                </select>
              </label>
              {!batch.offeringId ? <label>Offering label<input className="input" value={batch.offeringLabel} onChange={(event) => updateBatch(batch.key, { offeringLabel: event.target.value })} /></label> : null}
              <label>Location<input className="input" value={batch.location} onChange={(event) => updateBatch(batch.key, { location: event.target.value })} placeholder="Taiwan, Arizona, Kyoto…" /></label>
              <label>Year<input className="input" type="number" value={batch.year} onChange={(event) => updateBatch(batch.key, { year: event.target.value })} /></label>
              <label>Languages<input className="input" value={batch.languages} onChange={(event) => updateBatch(batch.key, { languages: event.target.value })} placeholder="en, zh" /></label>
              {!batch.offeringId ? <label>Offering status
                <select className="input" value={batch.offeringStatus} onChange={(event) => updateBatch(batch.key, { offeringStatus: event.target.value })}>
                  <option value="draft">Draft</option><option value="published">Published</option>
                </select>
              </label> : null}
            </div>

            {course && course.kind !== 'classics' ? (
              <div className="archive-section-settings">
                <div><strong>Optional program section</strong><div className="meta">Useful for Living Lam Rim Terms or Perfection of Wisdom parts/seasons.</div></div>
                <select className="input" value={batch.groupKind} onChange={(event) => updateBatch(batch.key, { groupKind: event.target.value })}>
                  <option value="term">Term</option><option value="season">Season</option><option value="part">Part</option><option value="module">Module</option><option value="other">Other</option>
                </select>
                <input className="input" value={batch.groupLabel} onChange={(event) => updateBatch(batch.key, { groupLabel: event.target.value })} list={`groups-${batch.key}`} placeholder="e.g. Term 1 or Season 2" />
                <datalist id={`groups-${batch.key}`}>{existingGroups.map((group) => <option key={group.id} value={group.label} />)}</datalist>
              </div>
            ) : null}

            <div className="archive-bulk-controls">
              <div><strong>Bulk edit included rows</strong><span className="meta">Default session status is Published.</span></div>
              <label>Sort rows
                <select className="input" value={batch.sortMode} onChange={(event) => sortBatchRows(batch.key, event.target.value as SortMode)}>
                  <option value="class">Class order</option>
                  <option value="date">Date</option>
                </select>
              </label>
              <label>Status
                <select className="input" defaultValue="published" onChange={(event) => applyStatus(batch.key, event.target.value)}>
                  <option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
                </select>
              </label>
              <label>Add teacher to all
                <select className="input" defaultValue="" onChange={(event) => { addTeacherToAll(batch.key, event.target.value); event.currentTarget.value = '' }}>
                  <option value="">Choose teacher…</option>
                  {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
                </select>
              </label>
            </div>
            <p className="meta" style={{ marginTop: 8 }}>Class order puts Classes 1–10+ first, then Meditations, Reviews, Q&amp;A, Vows, and Other. Date uses the detected session date and places undated rows last.</p>

            <div className="archive-row-list">
              {batch.rows.map((row, rowIndex) => (
                <div className={row.warning ? 'archive-row needs-review' : 'archive-row'} key={row.key}>
                  <label className="archive-row-check"><input type="checkbox" checked={row.include} onChange={(event) => updateRow(batch.key, row.key, { include: event.target.checked })} /><span>{rowIndex + 1}</span></label>
                  <input className="input archive-code" value={row.code} onChange={(event) => updateRow(batch.key, row.key, { code: event.target.value })} aria-label="Session code" />
                  <div className="archive-title-cell">
                    <input className="input" value={row.title} onChange={(event) => updateRow(batch.key, row.key, { title: event.target.value })} aria-label="Session title" />
                    <small>{row.rawTitle}</small>
                    {row.warning ? <span className="archive-warning">Review · {row.warning}</span> : null}
                  </div>
                  <select className="input" value={row.sessionType} onChange={(event) => updateRow(batch.key, row.key, { sessionType: event.target.value })} aria-label="Session type">
                    {sessionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input className="input" type="date" value={row.sessionDate} onChange={(event) => updateRow(batch.key, row.key, { sessionDate: event.target.value })} aria-label="Session date" />
                  <details className="archive-teacher-picker">
                    <summary>{row.teacherIds.length ? row.teacherIds.map((id) => teacherMap.get(id)).filter(Boolean).join(', ') : 'Teacher'}</summary>
                    <div>
                      {teachers.map((teacher) => (
                        <label key={teacher.id}><input type="checkbox" checked={row.teacherIds.includes(teacher.id)} onChange={(event) => updateRow(batch.key, row.key, { teacherIds: event.target.checked ? [...row.teacherIds, teacher.id] : row.teacherIds.filter((id) => id !== teacher.id) })} /> {teacher.full_name}</label>
                      ))}
                    </div>
                  </details>
                  <select className="input" value={row.status} onChange={(event) => updateRow(batch.key, row.key, { status: event.target.value })} aria-label="Status">
                    <option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
                  </select>
                  {row.sessionId ? <span className="pill">Updates existing</span> : <span className="pill">New</span>}
                </div>
              ))}
            </div>
          </article>
        )
      })}

      {batches.length ? (
        <div className="archive-import-submit">
          <div><strong>{batches.length} CSV file{batches.length === 1 ? '' : 's'} ready for review</strong><div className="meta">Files are imported one at a time. Only checked rows will be imported, and a safe retry will reuse recordings already created.</div></div>
          <button className="button red" type="button" disabled={busy} onClick={applyAll}>{busy ? 'Importing…' : 'Import reviewed archive'}</button>
        </div>
      ) : null}

      {message ? <p className="archive-import-message" aria-live="polite">{message}</p> : null}
    </section>
  )
}
