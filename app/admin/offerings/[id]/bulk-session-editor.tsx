'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadBulkEditSessions, saveBulkEditSessions, type BulkEditSessionRow } from './bulk-edit-actions'

type Teacher = { id: string; full_name: string }

const sessionTypes = [
  ['class', 'Class'], ['meditation', 'Meditation'], ['review', 'Review'], ['qna', 'Q&A'], ['vows', 'Vows'], ['other', 'Other'],
]

export default function BulkSessionEditor({ offeringId }: { offeringId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<BulkEditSessionRow[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const teacherMap = useMemo(() => new Map(teachers.map((teacher) => [teacher.id, teacher.full_name])), [teachers])

  async function openEditor() {
    setOpen(true)
    if (rows.length || busy) return
    setBusy(true)
    setMessage('Loading sessions…')
    try {
      const data = await loadBulkEditSessions(offeringId)
      setRows(data.rows)
      setTeachers(data.teachers as Teacher[])
      setLabel(data.offeringLabel)
      setMessage(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load sessions.')
    } finally {
      setBusy(false)
    }
  }

  function updateRow(id: string, patch: Partial<BulkEditSessionRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row))
  }

  function setAllStatus(status: string) {
    setRows((current) => current.map((row) => ({ ...row, status })))
  }

  function addTeacherToAll(teacherId: string) {
    if (!teacherId) return
    setRows((current) => current.map((row) => ({ ...row, teacherIds: Array.from(new Set([...row.teacherIds, teacherId])) })))
  }

  async function saveAll() {
    if (busy || !rows.length) return
    setBusy(true)
    setMessage('Saving all sessions…')
    try {
      const result = await saveBulkEditSessions(offeringId, rows)
      setMessage(result.message)
      if (result.ok) router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bulk update failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className="button" type="button" onClick={openEditor}>Bulk edit sessions</button>
      {open ? (
        <div className="admin-catalog-modal-root" role="presentation">
          <button className="admin-editor-backdrop" type="button" aria-label="Close bulk editor" onClick={() => setOpen(false)} />
          <section className="admin-catalog-modal bulk-session-modal" role="dialog" aria-modal="true" aria-label={`Bulk edit ${label || 'Course Offering'} sessions`}>
            <header className="admin-catalog-modal-head">
              <div><div className="eyebrow">Bulk editing</div><h2>{label || 'Course Offering sessions'}</h2></div>
              <button className="admin-dialog-close" type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>

            <div className="bulk-session-controls">
              <label>Set status for all
                <select className="input" defaultValue="" onChange={(event) => { if (event.target.value) setAllStatus(event.target.value); event.currentTarget.value = '' }}>
                  <option value="">Choose…</option><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
                </select>
              </label>
              <label>Add teacher to all
                <select className="input" defaultValue="" onChange={(event) => { addTeacherToAll(event.target.value); event.currentTarget.value = '' }}>
                  <option value="">Choose teacher…</option>{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{teacher.full_name}</option>)}
                </select>
              </label>
              <div><span className="meta">{rows.length} session{rows.length === 1 ? '' : 's'}</span></div>
            </div>

            <div className="bulk-session-table">
              {rows.map((row) => (
                <div className="bulk-session-row" key={row.id}>
                  <input className="input bulk-session-code" value={row.code} onChange={(event) => updateRow(row.id, { code: event.target.value })} aria-label="Code" />
                  <input className="input" value={row.title} onChange={(event) => updateRow(row.id, { title: event.target.value })} aria-label="Title" />
                  <select className="input" value={row.sessionType} onChange={(event) => updateRow(row.id, { sessionType: event.target.value })} aria-label="Type">
                    {sessionTypes.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                  </select>
                  <input className="input" type="date" value={row.sessionDate} onChange={(event) => updateRow(row.id, { sessionDate: event.target.value })} aria-label="Date" />
                  <details className="archive-teacher-picker">
                    <summary>{row.teacherIds.length ? row.teacherIds.map((id) => teacherMap.get(id)).filter(Boolean).join(', ') : 'Teacher'}</summary>
                    <div>{teachers.map((teacher) => <label key={teacher.id}><input type="checkbox" checked={row.teacherIds.includes(teacher.id)} onChange={(event) => updateRow(row.id, { teacherIds: event.target.checked ? [...row.teacherIds, teacher.id] : row.teacherIds.filter((id) => id !== teacher.id) })} /> {teacher.full_name}</label>)}</div>
                  </details>
                  <select className="input" value={row.status} onChange={(event) => updateRow(row.id, { status: event.target.value })} aria-label="Status">
                    <option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
                  </select>
                </div>
              ))}
            </div>

            {message ? <p className="archive-import-message" aria-live="polite">{message}</p> : null}
            <div className="actions"><button className="button red" type="button" disabled={busy || !rows.length} onClick={saveAll}>{busy ? 'Saving…' : 'Save all session changes'}</button></div>
          </section>
        </div>
      ) : null}
    </>
  )
}
