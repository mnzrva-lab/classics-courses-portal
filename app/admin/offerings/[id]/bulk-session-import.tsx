'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { importSessionScaffold } from './bulk-session-actions'

type ParsedRow = {
  key: string
  rowNumber: number
  code: string
  title: string
  type: string
  date: string
  start: string
  end: string
  timezone: string
  teacher: string
  section: string
  recording_url: string
  audio_url: string
  required: string
  state: 'ready' | 'working' | 'done' | 'error'
  message: string
}

type Props = {
  offeringId: string
  courseId: string
  defaultTimezone: string
}

const HEADER_ALIASES: Record<string, keyof Omit<ParsedRow, 'key' | 'rowNumber' | 'state' | 'message'>> = {
  code: 'code',
  class: 'code',
  session_code: 'code',
  title: 'title',
  name: 'title',
  type: 'type',
  session_type: 'type',
  date: 'date',
  session_date: 'date',
  start: 'start',
  start_time: 'start',
  end: 'end',
  end_time: 'end',
  timezone: 'timezone',
  source_timezone: 'timezone',
  teacher: 'teacher',
  teachers: 'teacher',
  section: 'section',
  term: 'section',
  module: 'section',
  part: 'section',
  recording: 'recording_url',
  recording_url: 'recording_url',
  audio: 'audio_url',
  audio_url: 'audio_url',
  required: 'required',
  required_for_completion: 'required',
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function parseDelimitedLine(line: string, delimiter: string) {
  const values: string[] = []
  let current = ''
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

function parseInput(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim())
  if (lines.length < 2) return { rows: [] as ParsedRow[], error: 'Paste a header row and at least one session row.' }

  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const rawHeaders = parseDelimitedLine(lines[0], delimiter)
  const headers = rawHeaders.map((header) => HEADER_ALIASES[normalizeHeader(header)] ?? null)
  if (!headers.includes('title')) return { rows: [] as ParsedRow[], error: 'A title column is required.' }

  const rows: ParsedRow[] = []
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseDelimitedLine(lines[lineIndex], delimiter)
    const base = {
      code: '', title: '', type: '', date: '', start: '', end: '', timezone: '', teacher: '', section: '', recording_url: '', audio_url: '', required: '',
    }

    headers.forEach((field, index) => {
      if (field) base[field] = cells[index]?.trim() ?? ''
    })
    if (!Object.values(base).some(Boolean)) continue

    rows.push({
      key: `row-${lineIndex + 1}-${base.code}-${base.title}`,
      rowNumber: lineIndex + 1,
      ...base,
      state: 'ready',
      message: '',
    })
  }

  return { rows, error: rows.length ? '' : 'No session rows were found.' }
}

export default function BulkSessionImport({ offeringId, courseId, defaultTimezone }: Props) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseError, setParseError] = useState('')
  const [running, setRunning] = useState(false)
  const counts = useMemo(() => ({
    ready: rows.filter((row) => row.state === 'ready').length,
    done: rows.filter((row) => row.state === 'done').length,
    error: rows.filter((row) => row.state === 'error').length,
  }), [rows])

  function updateRow(key: string, patch: Partial<ParsedRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row))
  }

  function preview() {
    const parsed = parseInput(text)
    setRows(parsed.rows)
    setParseError(parsed.error)
  }

  async function importAll() {
    if (running || !rows.length) return
    setRunning(true)
    try {
      for (const current of rows) {
        if (current.state === 'done') continue
        updateRow(current.key, { state: 'working', message: 'Creating…' })
        try {
          const result = await importSessionScaffold(offeringId, courseId, defaultTimezone, {
            code: current.code,
            title: current.title,
            type: current.type,
            date: current.date,
            start: current.start,
            end: current.end,
            timezone: current.timezone,
            teacher: current.teacher,
            section: current.section,
            recording_url: current.recording_url,
            audio_url: current.audio_url,
            required: current.required,
          })
          updateRow(current.key, {
            state: result.ok ? 'done' : 'error',
            message: result.message,
          })
        } catch (error) {
          updateRow(current.key, { state: 'error', message: error instanceof Error ? error.message : 'Import failed.' })
        }
      }
      router.refresh()
    } finally {
      setRunning(false)
    }
  }

  const template = 'code\ttitle\ttype\tdate\tstart\tend\ttimezone\tteacher\tsection\trecording_url\taudio_url\trequired\nC1\tClass 1\tclass\t2026-01-01\t07:00\t08:30\tAmerica/Phoenix\tTimothy Lowenhaupt\tTerm 1\t\t\tyes'

  return (
    <div className="form-stack">
      <div className="note">
        <strong>Paste from a spreadsheet or CSV</strong>
        <div className="meta" style={{ marginTop: 6 }}>
          Required column: <code>title</code>. Optional columns: code, type, date, start, end, timezone, teacher, section, recording_url, audio_url, required. Multiple teachers can be separated with <code>|</code>. Every imported session is forced to Draft.
        </div>
      </div>

      <textarea
        className="input"
        rows={9}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={template}
        disabled={running}
      />
      <div className="actions">
        <button className="button" type="button" onClick={preview} disabled={running || !text.trim()}>Preview rows</button>
        {rows.length ? <button className="button red" type="button" onClick={importAll} disabled={running}>{running ? 'Importing…' : 'Import all as Draft'}</button> : null}
      </div>

      {parseError ? <div className="meta">{parseError}</div> : null}
      {rows.length ? (
        <div>
          <div className="meta" style={{ marginBottom: 10 }}>{rows.length} row{rows.length === 1 ? '' : 's'} · {counts.done} created · {counts.error} need attention</div>
          {rows.map((row) => (
            <div key={row.key} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div>
                  <strong>{row.code ? `${row.code} · ` : ''}{row.title || 'Untitled row'}</strong>
                  <div className="meta">
                    Row {row.rowNumber}{row.type ? ` · ${row.type}` : ''}{row.date ? ` · ${row.date}` : ''}{row.section ? ` · ${row.section}` : ''}
                  </div>
                </div>
                <span className="pill">{row.state === 'done' ? 'Created' : row.state === 'error' ? 'Needs attention' : row.state === 'working' ? 'Working' : 'Ready'}</span>
              </div>
              {row.message ? <div className="meta" style={{ marginTop: 6 }}>{row.message}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
