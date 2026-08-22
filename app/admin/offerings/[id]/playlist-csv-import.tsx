'use client'

import { ChangeEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  applyPlaylistCsvImport,
  preparePlaylistCsvImport,
  type PlaylistCsvRow,
  type PlaylistPreparedRow,
  type PlaylistSessionOption,
} from './playlist-actions'

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (char === '"') {
      if (quoted && next === '"') {
        field += '"'
        i += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (char === ',' && !quoted) {
      row.push(field)
      field = ''
      continue
    }
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

function rowObjects(text: string): PlaylistCsvRow[] {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('The CSV does not contain any video rows.')
  const headers = rows[0].map((value) => value.trim())
  const index = new Map(headers.map((header, position) => [header.toLowerCase(), position]))
  const get = (row: string[], name: string) => row[index.get(name.toLowerCase()) ?? -1]?.trim() ?? ''
  if (!index.has('video title') || !index.has('video url')) throw new Error('The CSV needs Video Title and Video URL columns.')

  return rows.slice(1).map((row, rowIndex) => {
    const positionText = get(row, 'Position')
    const numericPosition = positionText === '' ? null : Number(positionText)
    return {
      key: `${rowIndex}:${get(row, 'Video ID') || get(row, 'Video URL')}`,
      position: numericPosition != null && Number.isFinite(numericPosition) ? numericPosition : null,
      playlistTitle: get(row, 'Playlist Title'),
      playlistUrl: get(row, 'Playlist URL'),
      videoTitle: get(row, 'Video Title'),
      videoUrl: get(row, 'Video URL'),
      availability: get(row, 'Availability Status'),
    }
  }).filter((row: PlaylistCsvRow & { availability?: string }) => row.videoUrl && (!row.availability || row.availability.toLowerCase() === 'available'))
    .map(({ availability: _availability, ...row }) => row)
}

function pastedRows(text: string): PlaylistCsvRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  return lines.map((line, index) => {
    const separator = line.lastIndexOf('|')
    const hasTitle = separator > 0 && /^https?:\/\//i.test(line.slice(separator + 1).trim())
    const videoUrl = hasTitle ? line.slice(separator + 1).trim() : line
    const videoTitle = hasTitle ? line.slice(0, separator).trim() : `Class ${index + 1}`
    return {
      key: `paste:${index}:${videoUrl}`,
      position: null,
      playlistTitle: '',
      playlistUrl: '',
      videoTitle,
      videoUrl,
    }
  }).filter((row) => /^https?:\/\//i.test(row.videoUrl))
}

export default function PlaylistCsvImport({ offeringId }: { offeringId: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [rows, setRows] = useState<PlaylistPreparedRow[]>([])
  const [sessions, setSessions] = useState<PlaylistSessionOption[]>([])
  const [playlistTitle, setPlaylistTitle] = useState('')
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [pasted, setPasted] = useState('')
  const [emptyOffering, setEmptyOffering] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function prepare(raw: PlaylistCsvRow[], source: 'csv' | 'paste') {
    if (!raw.length) throw new Error(source === 'csv' ? 'No available videos were found in this CSV.' : 'Paste at least one valid video URL.')
    const prepared = await preparePlaylistCsvImport(offeringId, raw)
    if (!prepared.ok) throw new Error(prepared.error)
    setRows(prepared.rows)
    setSessions(prepared.sessions)
    setEmptyOffering(prepared.emptyOffering)
    if (source === 'csv') {
      setPlaylistTitle(raw.find((row) => row.playlistTitle)?.playlistTitle ?? '')
      setPlaylistUrl(raw.find((row) => row.playlistUrl)?.playlistUrl ?? '')
    } else {
      setPlaylistTitle('')
      setPlaylistUrl('')
    }
    const matched = prepared.rows.filter((row) => row.sessionId).length
    const creating = prepared.rows.filter((row) => row.createNew).length
    if (prepared.emptyOffering) {
      setMessage(`${creating} Draft session${creating === 1 ? '' : 's'} will be created from these recordings. Review the list before applying.`)
    } else {
      setMessage(`${matched} of ${prepared.rows.length} videos matched existing sessions${creating ? `; ${creating} will create new Draft sessions` : ''}. Review before applying.`)
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setMessage('Reading playlist CSV…')
    try {
      await prepare(rowObjects(await file.text()), 'csv')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read this CSV.')
      setRows([])
      setSessions([])
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  async function preparePasted() {
    if (busy) return
    setBusy(true)
    setMessage('Preparing recording list…')
    try {
      await prepare(pastedRows(pasted), 'paste')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not prepare these recording URLs.')
      setRows([])
      setSessions([])
    } finally {
      setBusy(false)
    }
  }

  function setTarget(rowKey: string, target: string) {
    setRows((current) => current.map((row) => {
      if (row.key !== rowKey) return row
      if (target === '__create__') return { ...row, sessionId: '', createNew: true, matchNote: `Will create ${row.proposedCode || 'a new session'} as Draft.` }
      if (!target) return { ...row, sessionId: '', createNew: false, matchNote: 'Will not import this video.' }
      return { ...row, sessionId: target, createNew: false, matchNote: 'Existing session selected.' }
    }))
  }

  async function applyImport() {
    if (busy || !rows.length) return
    setBusy(true)
    setMessage('Creating/updating sessions and recording URLs…')
    try {
      const result = await applyPlaylistCsvImport(
        offeringId,
        rows.map((row) => ({
          sessionId: row.sessionId,
          createNew: row.createNew,
          videoUrl: row.videoUrl,
          videoTitle: row.videoTitle,
          proposedCode: row.proposedCode,
          proposedTitle: row.proposedTitle,
          proposedType: row.proposedType,
          position: row.position,
        })),
        { url: playlistUrl, title: playlistTitle },
      )
      if (!result.ok) throw new Error(result.error)
      const pieces = []
      if (result.created) pieces.push(`${result.created} Draft session${result.created === 1 ? '' : 's'} created`)
      if (result.updated) pieces.push(`${result.updated} Recording URL${result.updated === 1 ? '' : 's'} updated`)
      if (result.playlistSaved) pieces.push('course playlist saved as a Draft Course resource')
      setMessage(pieces.length ? `Done. ${pieces.join(', ')}.` : 'Nothing was changed. Choose at least one target.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Recording import failed.')
    } finally {
      setBusy(false)
    }
  }

  const canApply = rows.some((row) => row.sessionId || row.createNew)

  return (
    <details className="admin-playlist-import">
      <summary className="button">Import recordings</summary>
      <div className="admin-playlist-import-panel">
        <p className="meta">For an existing course, match recordings to its sessions. For an archive Course Offering with no sessions yet, the importer can create the class list as Draft sessions and attach the Recording URLs automatically.</p>

        <div className="recording-import-source-grid">
          <div className="recording-import-source">
            <strong>YouTube playlist CSV</strong>
            <p className="meta">Uses the playlist export you already have, including video titles and Playlist URL.</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} disabled={busy} hidden />
            <button className="button sage" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Working…' : 'Choose playlist CSV'}</button>
          </div>

          <div className="recording-import-source">
            <strong>Paste video URLs</strong>
            <p className="meta">One URL per line. Optional: <code>Class 1 title | https://youtu.be/…</code>. With URLs only, sessions are named Class 1, Class 2, etc.</p>
            <textarea className="input" rows={4} value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={'https://youtu.be/…\nhttps://youtu.be/…'} />
            <button className="button" type="button" disabled={busy || !pasted.trim()} onClick={preparePasted}>Prepare URLs</button>
          </div>
        </div>

        {rows.length ? (
          <div className="playlist-import-rows">
            {emptyOffering ? <div className="note"><strong>New archive setup</strong><div className="meta">This Course Offering has no sessions yet. New sessions will stay Draft until you review and publish them.</div></div> : null}
            {rows.map((row) => {
              const value = row.createNew ? '__create__' : row.sessionId
              return (
                <div className="playlist-import-row" key={row.key}>
                  <div>
                    <strong>{row.videoTitle}</strong>
                    <div className="meta">{row.matchNote}</div>
                    {row.createNew ? <div className="playlist-proposed-session">{row.proposedCode || 'New'} · {row.proposedType} · {row.proposedTitle}</div> : null}
                  </div>
                  <select className="input" value={value} disabled={busy} onChange={(event) => setTarget(row.key, event.target.value)}>
                    <option value="">Do not import</option>
                    <option value="__create__">Create new Draft session</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.code ? `${session.code} · ` : ''}{session.title}{session.recordingUrl ? ' · recording already set' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
            {playlistUrl ? <div className="playlist-import-playlist"><strong>Course playlist</strong><span className="meta">{playlistTitle || playlistUrl} · saved as Draft course resource</span></div> : null}
            <button className="button red" type="button" disabled={busy || !canApply} onClick={applyImport}>{busy ? 'Working…' : 'Apply sessions + recordings'}</button>
          </div>
        ) : null}
        {message ? <p className="meta" aria-live="polite">{message}</p> : null}
      </div>
    </details>
  )
}
