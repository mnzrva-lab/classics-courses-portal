'use client'

import { ChangeEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { applyPlaylistCsvImport, preparePlaylistCsvImport, type PlaylistCsvRow, type PlaylistPreparedRow, type PlaylistSessionOption } from './playlist-actions'

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
      row = []; field = ''; continue
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

  const parsed = rows.slice(1).map((row, rowIndex) => {
    const positionValue = get(row, 'Position')
    return {
      key: `${rowIndex}:${get(row, 'Video ID') || get(row, 'Video URL')}`,
      position: positionValue !== '' && Number.isFinite(Number(positionValue)) ? Number(positionValue) : null,
      playlistTitle: get(row, 'Playlist Title'),
      playlistUrl: get(row, 'Playlist URL'),
      videoTitle: get(row, 'Video Title'),
      videoUrl: get(row, 'Video URL'),
      availability: get(row, 'Availability Status'),
    }
  })

  return parsed
    .filter((row) => row.videoUrl && (!row.availability || row.availability.toLowerCase() === 'available'))
    .map((row) => ({
      key: row.key,
      position: row.position,
      playlistTitle: row.playlistTitle,
      playlistUrl: row.playlistUrl,
      videoTitle: row.videoTitle,
      videoUrl: row.videoUrl,
    }))
}

export default function PlaylistCsvImport({ offeringId }: { offeringId: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [rows, setRows] = useState<PlaylistPreparedRow[]>([])
  const [sessions, setSessions] = useState<PlaylistSessionOption[]>([])
  const [playlistTitle, setPlaylistTitle] = useState('')
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setMessage('Reading playlist CSV…')
    try {
      const raw = rowObjects(await file.text())
      if (!raw.length) throw new Error('No available videos were found in this CSV.')
      const prepared = await preparePlaylistCsvImport(offeringId, raw)
      setRows(prepared.rows)
      setSessions(prepared.sessions)
      setPlaylistTitle(raw.find((row) => row.playlistTitle)?.playlistTitle ?? '')
      setPlaylistUrl(raw.find((row) => row.playlistUrl)?.playlistUrl ?? '')
      const matched = prepared.rows.filter((row) => row.sessionId).length
      setMessage(`${matched} of ${prepared.rows.length} videos matched automatically. Review the matches before applying.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read this CSV.')
      setRows([])
      setSessions([])
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  function setSession(rowKey: string, sessionId: string) {
    setRows((current) => current.map((row) => row.key === rowKey ? { ...row, sessionId, matchNote: sessionId ? 'Match selected manually.' : 'Do not import this video.' } : row))
  }

  async function applyImport() {
    if (busy || !rows.length) return
    setBusy(true)
    setMessage('Applying recording URLs and playlist…')
    try {
      const result = await applyPlaylistCsvImport(
        offeringId,
        rows.map((row) => ({ sessionId: row.sessionId, videoUrl: row.videoUrl })),
        { url: playlistUrl, title: playlistTitle },
      )
      setMessage(`Done. ${result.updated} Recording URL${result.updated === 1 ? '' : 's'} updated${result.playlistSaved ? ' and the course playlist was added to Course resources' : ''}.`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Playlist import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="admin-playlist-import">
      <summary className="button">Import recordings</summary>
      <div className="admin-playlist-import-panel">
        <p className="meta">Use this when the Course Offering sessions already exist. It matches individual videos to those sessions and saves the playlist as a course resource. To create whole archives from CSVs, use Bulk archive import from the main Admin page.</p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} disabled={busy} hidden />
        <button className="button sage" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Working…' : 'Choose playlist CSV'}</button>
        {rows.length ? (
          <div className="playlist-import-rows">
            {rows.map((row) => (
              <div className="playlist-import-row" key={row.key}>
                <div><strong>{row.videoTitle}</strong><div className="meta">{row.matchNote}</div></div>
                <select className="input" value={row.sessionId} disabled={busy} onChange={(event) => setSession(row.key, event.target.value)}>
                  <option value="">Do not import</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>{session.code ? `${session.code} · ` : ''}{session.title}{session.recordingUrl ? ' · recording already set' : ''}</option>
                  ))}
                </select>
              </div>
            ))}
            {playlistUrl ? <div className="playlist-import-playlist"><strong>Course playlist</strong><span className="meta">{playlistTitle || playlistUrl}</span></div> : null}
            <button className="button red" type="button" disabled={busy || !rows.some((row) => row.sessionId)} onClick={applyImport}>Apply recording URLs + playlist</button>
          </div>
        ) : null}
        {message ? <p className="meta" aria-live="polite">{message}</p> : null}
      </div>
    </details>
  )
}
