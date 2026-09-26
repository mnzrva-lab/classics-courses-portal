'use client'

import { useEffect, useMemo, useState } from 'react'
import { createTeacher, updateTeacher } from './actions'

type Teacher = { id: string; slug: string; full_name: string; bio: string | null; active: boolean }
type Modal = { kind: 'create' } | { kind: 'edit'; id: string } | null

export default function TeacherManagerClient({ teachers }: { teachers: Teacher[] }) {
  const [modal, setModal] = useState<Modal>(null)
  const active = useMemo(() => modal?.kind === 'edit' ? teachers.find((teacher) => teacher.id === modal.id) ?? null : null, [teachers, modal])

  useEffect(() => {
    document.body.classList.toggle('admin-modal-open', Boolean(modal))
    if (!modal) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null) }
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('keydown', close); document.body.classList.remove('admin-modal-open') }
  }, [modal])

  return (
    <>
      <section className="admin-course-create-card">
        <div><div className="eyebrow">Teacher</div><strong>Add a teacher</strong><p className="meta">Name and bio are stored once and reused across courses, sessions and meditation versions.</p></div>
        <button className="button red" type="button" onClick={() => setModal({ kind: 'create' })}>+ Add teacher</button>
      </section>

      <section className="section admin-course-catalog-section">
        <div className="eyebrow">Teachers</div><h2>Current teachers</h2>
        <div className="admin-course-list">
          {teachers.map((teacher) => (
            <article className="admin-course-row" key={teacher.id}>
              <div className="admin-course-row-copy">
                <div className="eyebrow">{teacher.active ? 'Active' : 'Inactive'}</div>
                <strong>{teacher.full_name}</strong>
                <span className="meta">{teacher.bio?.trim() ? 'Bio added' : 'Bio not added'}</span>
              </div>
              <button className="button" type="button" onClick={() => setModal({ kind: 'edit', id: teacher.id })}>Edit</button>
            </article>
          ))}
        </div>
      </section>

      {modal ? (
        <div className="admin-catalog-modal-root" role="presentation">
          <button className="admin-editor-backdrop" type="button" aria-label="Close teacher editor" onClick={() => setModal(null)} />
          <section className="admin-catalog-modal" role="dialog" aria-modal="true" aria-label={modal.kind === 'create' ? 'Add teacher' : `Edit ${active?.full_name ?? 'teacher'}`}>
            <header className="admin-catalog-modal-head">
              <div><div className="eyebrow">Teacher</div><h2>{modal.kind === 'create' ? 'Add teacher' : active?.full_name}</h2></div>
              <button className="admin-dialog-close" type="button" onClick={() => setModal(null)} aria-label="Close">×</button>
            </header>
            <form className="form-stack" action={modal.kind === 'create' ? createTeacher : updateTeacher.bind(null, active!.id)}>
              <div className="grid two">
                <label>Full name<input className="input" name="full_name" defaultValue={active?.full_name ?? ''} required /></label>
                <label>Slug<input className="input" name="slug" defaultValue={active?.slug ?? ''} placeholder="Optional URL-safe name" /></label>
              </div>
              <label>Bio<textarea className="input" name="bio" rows={6} defaultValue={active?.bio ?? ''} placeholder="Short teacher biography. Students can open it from a class page." /></label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}><input type="checkbox" name="active" defaultChecked={active?.active ?? true} /> Active and available for assignment</label>
              <div className="actions"><button className="button red" type="submit">{modal.kind === 'create' ? 'Add teacher' : 'Save teacher'}</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}
