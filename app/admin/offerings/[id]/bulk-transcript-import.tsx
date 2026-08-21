'use client'

import { ChangeEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import mammoth from 'mammoth'
import { createClient } from '@/lib/supabase/client'
import { importTranscriptDraft } from './bulk-actions'

const TRANSCRIPT_ASSETS_BUCKET = 'transcript-assets'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

type SessionOption = {
  id: string
  code: string | null
  title: string
  transcriptStatus: string | null
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

function imageExtension(contentType: string) {
  const known: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  return known[contentType.toLowerCase()] ?? 'bin'
}

function isTranscriptDisclaimer(text: string) {
  return text.startsWith('This transcript was created by a student with AI and should be used for reference only.')
}

function transcriptTextFromHtml(html: string) {
  const document = new DOMParser().parseFromString(`<div id="docx-root">${html}</div>`, 'text/html')
  const root = document.querySelector('#docx-root')
  if (!root) return ''

  const blocks: string[] = []
  for (const element of Array.from(root.children)) {
    const tag = element.tagName.toUpperCase()
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim()

    if (tag === 'H1') continue
    if (tag === 'H2' || tag === 'H3' || tag === 'H4') {
      if (text) blocks.push(`### ${text}`)
      continue
    }

    if (tag === 'P') {
      if (text && !isTranscriptDisclaimer(text)) blocks.push(text)
      for (const image of Array.from(element.querySelectorAll('img'))) {
        const source = image.getAttribute('src') ?? ''
        if (!source.startsWith('transcript-asset:')) continue
        blocks.push(`[[TRANSCRIPT_IMAGE|${source.slice('transcript-asset:'.length)}]]`)
      }
      continue
    }

    if (tag === 'UL' || tag === 'OL') {
      for (const item of Array.from(element.querySelectorAll(':scope > li'))) {
        const itemText = (item.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (itemText) blocks.push(itemText)
      }
      continue
    }

    if (text && !isTranscriptDisclaimer(text)) blocks.push(text)
  }

  return blocks.join('\n\n').trim()
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

export default function BulkTranscriptImport({ offeringId, sessions }: Props) {
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

  async function removeUploads(paths: string[]) {
    if (!paths.length) return
    const supabase = createClient()
    await supabase.storage.from(TRANSCRIPT_ASSETS_BUCKET).remove(paths)
  }

  async function readFile(row: ImportRow) {
    const lower = row.file.name.toLowerCase()
    if (lower.endsWith('.md') || lower.endsWith('.txt')) {
      return { text: (await row.file.text()).trim(), uploadedPaths: [] as string[], imageCount: 0 }
    }
    if (!lower.endsWith('.docx')) throw new Error('Use DOCX, Markdown, or text files.')

    const supabase = createClient()
    const uploadedPaths: string[] = []

    try {
      const result = await mammoth.convertToHtml(
        { arrayBuffer: await row.file.arrayBuffer() },
        {
          styleMap: [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
          ],
          convertImage: mammoth.images.imgElement(async (image) => {
            const bytes = await image.readAsArrayBuffer()
            if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('An embedded transcript image is larger than 20 MB.')
            const extension = imageExtension(image.contentType)
            const storagePath = `transcripts/${row.sessionId}/${crypto.randomUUID()}.${extension}`
            const { error } = await supabase.storage
              .from(TRANSCRIPT_ASSETS_BUCKET)
              .upload(storagePath, new Blob([bytes], { type: image.contentType }), {
                cacheControl: '3600',
                contentType: image.contentType,
                upsert: false,
              })
            if (error) throw new Error(`Could not upload an embedded image: ${error.message}`)
            uploadedPaths.push(storagePath)
            return { src: `transcript-asset:${storagePath}|${image.contentType}` }
          }),
        },
      )

      const text = transcriptTextFromHtml(result.value)
      if (!text) throw new Error('No transcript text could be read from this DOCX file.')
      return { text, uploadedPaths, imageCount: uploadedPaths.length }
    } catch (error) {
      await removeUploads(uploadedPaths)
      throw error
    }
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
        if (selected.transcriptStatus) {
          updateRow(row.key, { state: 'skipped', message: `Existing ${selected.transcriptStatus} transcript. Bulk import will not replace it.` })
          continue
        }
        if (usedTargets.has(selected.id)) {
          updateRow(row.key, { state: 'error', message: 'Another selected file is already mapped to this session.' })
          continue
        }
        usedTargets.add(selected.id)
        updateRow(row.key, { state: 'working', message: 'Reading and importing…' })

        let uploadedPaths: string[] = []
        try {
          const imported = await readFile(row)
          uploadedPaths = imported.uploadedPaths
          const result = await importTranscriptDraft(offeringId, selected.id, row.file.name, imported.text)
          if (!result.ok) {
            await removeUploads(uploadedPaths)
            updateRow(row.key, { state: 'skipped', message: result.message })
            continue
          }
          updateRow(row.key, {
            state: 'done',
            message: `${result.message}${imported.imageCount ? ` Images preserved in source order.` : ''}`,
          })
        } catch (error) {
          await removeUploads(uploadedPaths)
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
          Select transcript files
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
            const existingStatus = selected?.transcriptStatus
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
                      <option value="">Choose session…</option>
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.code ? `${session.code} · ` : ''}{session.title}{session.transcriptStatus ? ` · transcript ${session.transcriptStatus}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {existingStatus && row.state === 'ready' ? <p className="meta">This session already has a {existingStatus} transcript and will be skipped.</p> : null}
                {row.message ? <p className="meta"><strong>{row.state === 'done' ? 'Done:' : row.state === 'error' ? 'Needs attention:' : row.state === 'skipped' ? 'Skipped:' : ''}</strong> {row.message}</p> : null}
                {row.state === 'done' && selected ? <a className="button" href={`/admin/sessions/${selected.id}`} style={{ marginTop: 6 }}>Open session</a> : null}
              </div>
            )
          })}
        </div>
      ) : <p className="meta">Choose several Course Offering transcript files at once. Class and Meditation numbers in filenames are matched automatically, and you can correct any match before importing.</p>}

      {rows.length > 0 ? (
        <div className="actions">
          <button className="button red" type="button" onClick={importAll} disabled={running}>
            {running ? 'Importing…' : 'Import all as Draft'}
          </button>
          <button className="button" type="button" onClick={() => setRows([])} disabled={running}>Clear selection</button>
        </div>
      ) : null}

      <p className="meta">Safety rule: bulk import never publishes and never overwrites an existing transcript. Existing transcripts remain untouched and can still be edited individually.</p>
    </div>
  )
}
