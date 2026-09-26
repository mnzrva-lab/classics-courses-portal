'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import mammoth from 'mammoth'
import { importStudyNotesDraft } from './bulk-study-notes-actions'

type SessionOption = {
  id: string
  code: string | null
  title: string
  notesStatus: string | null
}

type ImportRow = {
  key: string
  file: File
  sessionId: string
  state: 'ready' | 'working' | 'done' | 'skipped' | 'error'
  message: string
}

type Props = {
  offeringId: string
  sessions: SessionOption[]
}

function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\s+/g, ' ')
  if (!(node instanceof HTMLElement)) return ''
  const tag = node.tagName.toUpperCase()
  if (tag === 'UL' || tag === 'OL' || tag === 'IMG') return ''

  const content = Array.from(node.childNodes).map(inlineMarkdown).join('').replace(/\s+/g, ' ')
  if (!content.trim()) return ''
  if (tag === 'STRONG' || tag === 'B') return `**${content.trim()}**`
  if (tag === 'EM' || tag === 'I') return `*${content.trim()}*`
  if (tag === 'CODE') return `\`${content.trim()}\``
  if (tag === 'A') {
    const href = node.getAttribute('href')?.trim()
    return href ? `[${content.trim()}](${href})` : content
  }
  if (tag === 'BR') return '\n'
  return content
}

function listToMarkdown(list: Element, depth = 0): string[] {
  const ordered = list.tagName.toUpperCase() === 'OL'
  const rows: string[] = []
  const items = Array.from(list.children).filter((child) => child.tagName.toUpperCase() === 'LI')

  items.forEach((item, index) => {
    const directContent = Array.from(item.childNodes)
      .filter((node) => !(node instanceof HTMLElement && ['UL', 'OL'].includes(node.tagName.toUpperCase())))
      .map(inlineMarkdown)
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
    const prefix = ordered ? `${index + 1}.` : '-'
    if (directContent) rows.push(`${'  '.repeat(depth)}${prefix} ${directContent}`)
    for (const nested of Array.from(item.children).filter((child) => ['UL', 'OL'].includes(child.tagName.toUpperCase()))) {
      rows.push(...listToMarkdown(nested, depth + 1))
    }
  })

  return rows
}

function tableToMarkdown(table: Element) {
  const rows = Array.from(table.querySelectorAll('tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > th, :scope > td')).map((cell) =>
      Array.from(cell.childNodes).map(inlineMarkdown).join('').replace(/\|/g, '\\|').trim()
    )
  ).filter((row) => row.length)

  if (!rows.length) return ''
  const width = Math.max(...rows.map((row) => row.length))
  const normalized = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')])
  const header = normalized[0]
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...normalized.slice(1).map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function markdownFromHtml(html: string) {
  const document = new DOMParser().parseFromString(`<div id="notes-root">${html}</div>`, 'text/html')
  const root = document.querySelector('#notes-root')
  if (!root) return { markdown: '', imageCount: 0 }
  const blocks: string[] = []
  const imageCount = root.querySelectorAll('img').length

  for (const element of Array.from(root.children)) {
    const tag = element.tagName.toUpperCase()
    const content = Array.from(element.childNodes).map(inlineMarkdown).join('').replace(/\s+/g, ' ').trim()
    if (/^H[1-4]$/.test(tag)) {
      const level = Math.min(4, Math.max(2, Number(tag.slice(1)) + 1))
      if (content) blocks.push(`${'#'.repeat(level)} ${content}`)
    } else if (tag === 'P') {
      if (content) blocks.push(content)
    } else if (tag === 'UL' || tag === 'OL') {
      const lines = listToMarkdown(element)
      if (lines.length) blocks.push(lines.join('\n'))
    } else if (tag === 'BLOCKQUOTE') {
      if (content) blocks.push(content.split('\n').map((line) => `> ${line}`).join('\n'))
    } else if (tag === 'TABLE') {
      const table = tableToMarkdown(element)
      if (table) blocks.push(table)
    } else if (content) {
      blocks.push(content)
    }
  }

  return { markdown: blocks.join('\n\n').trim(), imageCount }
}

function detectSessionId(fileName: string, sessions: SessionOption[]) {
  const name = fileName.replace(/[_-]+/g, ' ')
  const meditation = name.match(/\bmeditation\s*0*(\d{1,2})\b/i)
  if (meditation) {
    const code = `M${Number(meditation[1])}`
    return sessions.find((session) => session.code?.toUpperCase() === code)?.id ?? ''
  }

  const classMatch = name.match(/\bclass\s*0*(\d{1,2})\b/i)
  if (classMatch) {
    const code = `C${Number(classMatch[1])}`
    return sessions.find((session) => session.code?.toUpperCase() === code)?.id ?? ''
  }

  return ''
}

export default function BulkStudyNotesImport({ offeringId, sessions }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<ImportRow[]>([])
  const [running, setRunning] = useState(false)
  const sessionsById = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions])

  function updateRow(key: string, patch: Partial<ImportRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row))
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    setRows(files.map((file, index) => ({
      key: `${file.name}:${file.size}:${file.lastModified}:${index}`,
      file,
      sessionId: detectSessionId(file.name, sessions),
      state: 'ready',
      message: '',
    })))
    event.target.value = ''
  }

  async function readFile(file: File) {
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.md') || lower.endsWith('.txt')) {
      return { text: (await file.text()).trim(), imageCount: 0 }
    }
    if (!lower.endsWith('.docx')) throw new Error('Use DOCX, Markdown, or text files.')

    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      {
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
        ],
      },
    )
    const converted = markdownFromHtml(result.value)
    if (!converted.markdown) throw new Error('No Study Notes text could be read from this DOCX file.')
    return { text: converted.markdown, imageCount: converted.imageCount }
  }

  async function importAll() {
    if (running || rows.length === 0) return
    setRunning(true)
    const usedTargets = new Set<string>()

    try {
      for (const row of rows) {
        const selected = sessionsById.get(row.sessionId)
        if (!selected) {
          updateRow(row.key, { state: 'error', message: 'Choose the matching session.' })
          continue
        }
        if (selected.notesStatus) {
          updateRow(row.key, { state: 'skipped', message: `Existing ${selected.notesStatus} Study Notes. Bulk import will not replace them.` })
          continue
        }
        if (usedTargets.has(selected.id)) {
          updateRow(row.key, { state: 'error', message: 'Another selected file is already mapped to this session.' })
          continue
        }
        usedTargets.add(selected.id)
        updateRow(row.key, { state: 'working', message: 'Reading and importing…' })

        try {
          const imported = await readFile(row.file)
          const result = await importStudyNotesDraft(offeringId, selected.id, row.file.name, imported.text)
          if (!result.ok) {
            updateRow(row.key, { state: 'skipped', message: result.message })
            continue
          }
          const imageMessage = imported.imageCount
            ? ` ${imported.imageCount} embedded image${imported.imageCount === 1 ? ' was' : 's were'} detected and should be reviewed as Class materials.`
            : ''
          updateRow(row.key, { state: 'done', message: `${result.message}${imageMessage}` })
        } catch (error) {
          updateRow(row.key, { state: 'error', message: error instanceof Error ? error.message : 'Import failed.' })
        }
      }
      router.refresh()
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="form-stack">
      <div>
        <label className="button sage" style={{ display: 'inline-block', cursor: running ? 'wait' : 'pointer' }}>
          Select Study Notes files
          <input
            type="file"
            multiple
            accept=".docx,.md,.txt,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFiles}
            disabled={running}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {rows.length > 0 ? (
        <div>
          {rows.map((row) => {
            const selected = sessionsById.get(row.sessionId)
            return (
              <div key={row.key} style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
                <div className="grid two">
                  <div>
                    <strong>{row.file.name}</strong>
                    <div className="meta">{Math.max(1, Math.round(row.file.size / 1024))} KB</div>
                  </div>
                  <label>Match to session
                    <select
                      className="input"
                      value={row.sessionId}
                      disabled={running || row.state === 'done'}
                      onChange={(event) => updateRow(row.key, { sessionId: event.target.value, state: 'ready', message: '' })}
                    >
                      <option value="">Choose session</option>
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.code ? `${session.code} · ` : ''}{session.title}{session.notesStatus ? ` · ${session.notesStatus} notes` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {row.message ? <div className="meta" style={{ marginTop: 8 }}>{row.state === 'done' ? '✓ ' : row.state === 'error' ? 'Could not import: ' : ''}{row.message}</div> : null}
                {selected?.notesStatus && row.state === 'ready' ? <div className="meta" style={{ marginTop: 6 }}>This session already has Study Notes and will be skipped.</div> : null}
              </div>
            )
          })}
          <div className="actions">
            <button className="button red" type="button" disabled={running} onClick={importAll}>
              {running ? 'Importing…' : 'Import all as Draft'}
            </button>
          </div>
        </div>
      ) : <p className="meta">Choose several Study Notes files. Class and Meditation numbers in filenames are matched automatically when possible.</p>}
    </div>
  )
}
