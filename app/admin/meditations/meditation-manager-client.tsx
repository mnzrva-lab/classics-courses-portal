'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createMeditation, createMeditationInstance, updateMeditation, updateMeditationInstance } from './actions'

type Meditation = { id: string; slug: string; name: string; description: string | null; topics: string[] | null; status: string }
type Session = { id: string; code: string | null; title: string; courses: { title: string } | null; course_offerings: { label: string } | null }
type Teacher = { id: string; full_name: string }
type Instance = {
  id: string; meditation_id: string; session_id: string; teacher_id: string | null; title: string | null; start_seconds: number | null; end_seconds: number | null; duration_seconds: number | null; audio_url: string | null; status: string;
  meditations: { name: string } | null; sessions: { code: string | null; title: string; courses: { title: string } | null; course_offerings: { label: string } | null } | null; teachers: { full_name: string } | null
}
type Modal = { kind: 'create-meditation' } | { kind: 'create-version'; meditationId?: string } | { kind: 'edit-meditation'; id: string } | { kind: 'edit-version'; id: string } | null

function sourceLabel(session: Session | Instance['sessions']) {
  if (!session) return 'Source session'
  return [session.courses?.title, session.course_offerings?.label, session.code ? `${session.code} · ${session.title}` : session.title].filter(Boolean).join(' · ')
}

export default function MeditationManagerClient({ meditations, sessions, teachers, instances }: { meditations: Meditation[]; sessions: Session[]; teachers: Teacher[]; instances: Instance[] }) {
  const [modal, setModal] = useState<Modal>(null)
  const activeMeditation = useMemo(() => modal?.kind === 'edit-meditation' ? meditations.find((item) => item.id === modal.id) ?? null : null, [modal, meditations])
  const activeInstance = useMemo(() => modal?.kind === 'edit-version' ? instances.find((item) => item.id === modal.id) ?? null : null, [modal, instances])

  useEffect(() => {
    document.body.classList.toggle('admin-modal-open', Boolean(modal))
    if (!modal) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null) }
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('keydown', close); document.body.classList.remove('admin-modal-open') }
  }, [modal])

  return (
    <>
      <section className="admin-mini-actions">
        <button className="admin-mini-action" type="button" onClick={() => setModal({ kind: 'create-meditation' })}>
          <span className="eyebrow">Practice</span><strong>+ New canonical meditation</strong><small>Create the practice once.</small>
        </button>
        <button className="admin-mini-action" type="button" onClick={() => setModal({ kind: 'create-version' })}>
          <span className="eyebrow">Version</span><strong>+ Link source meditation</strong><small>Connect a course meditation, teacher and audio.</small>
        </button>
      </section>

      <section className="section admin-course-catalog-section">
        <div className="eyebrow">Meditation library</div><h2>Canonical meditations</h2>
        <div className="admin-course-list">
          {meditations.map((meditation) => {
            const versions = instances.filter((instance) => instance.meditation_id === meditation.id)
            return (
              <article className="admin-course-row" key={meditation.id}>
                <div className="admin-course-row-copy">
                  <div className="eyebrow">{meditation.status}</div>
                  <strong>{meditation.name}</strong>
                  <span className="meta">{versions.length} version{versions.length === 1 ? '' : 's'}{meditation.topics?.length ? ` · ${meditation.topics.slice(0, 3).join(', ')}` : ''}</span>
                </div>
                <button className="button" type="button" onClick={() => setModal({ kind: 'edit-meditation', id: meditation.id })}>Manage</button>
              </article>
            )
          })}
        </div>
      </section>

      {modal ? (
        <div className="admin-catalog-modal-root" role="presentation">
          <button className="admin-editor-backdrop" type="button" aria-label="Close meditation editor" onClick={() => setModal(null)} />
          <section className="admin-catalog-modal meditation-admin-modal" role="dialog" aria-modal="true">
            <header className="admin-catalog-modal-head">
              <div>
                <div className="eyebrow">Meditations</div>
                <h2>{modal.kind === 'create-meditation' ? 'New canonical meditation' : modal.kind === 'create-version' ? 'Link meditation version' : modal.kind === 'edit-version' ? 'Edit meditation version' : activeMeditation?.name}</h2>
              </div>
              <button className="admin-dialog-close" type="button" onClick={() => setModal(null)} aria-label="Close">×</button>
            </header>

            {modal.kind === 'create-meditation' ? (
              <form className="form-stack" action={createMeditation}>
                <label>Name<input className="input" name="name" required /></label>
                <label>Description<textarea className="input" name="description" rows={4} /></label>
                <label>Topics<input className="input" name="topics" placeholder="karma, emptiness, compassion" /></label>
                <label>Status<select className="input" name="status" defaultValue="draft"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                <button className="button red" type="submit">Create meditation</button>
              </form>
            ) : modal.kind === 'create-version' ? (
              <form className="form-stack" action={createMeditationInstance}>
                <label>Meditation<select className="input" name="meditation_id" required defaultValue={modal.meditationId ?? ''}><option value="" disabled>Choose meditation</option>{meditations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label>Source meditation session<select className="input" name="session_id" required defaultValue=""><option value="" disabled>Choose source session</option>{sessions.map((session) => <option key={session.id} value={session.id}>{sourceLabel(session)}</option>)}</select></label>
                <div className="grid two">
                  <label>Teacher<select className="input" name="teacher_id" defaultValue=""><option value="">Use source session / not specified</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</select></label>
                  <label>Version title<input className="input" name="title" /></label>
                  <label>Duration, minutes<input className="input" name="duration_minutes" type="number" min="0" step="0.5" /></label>
                  <label>Audio URL<input className="input" name="audio_url" type="url" placeholder="Optional MP3/M4A" /></label>
                  <label>Start at seconds<input className="input" name="start_seconds" type="number" min="0" /></label>
                  <label>End at seconds<input className="input" name="end_seconds" type="number" min="0" /></label>
                </div>
                <label>Status<select className="input" name="status" defaultValue="draft"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                <button className="button red" type="submit">Add version</button>
              </form>
            ) : modal.kind === 'edit-version' && activeInstance ? (
              <form className="form-stack" action={updateMeditationInstance.bind(null, activeInstance.id)}>
                <div className="note"><strong>Source</strong><div className="meta">{sourceLabel(activeInstance.sessions)}</div></div>
                <div className="grid two">
                  <label>Version title<input className="input" name="title" defaultValue={activeInstance.title ?? ''} /></label>
                  <label>Teacher<select className="input" name="teacher_id" defaultValue={activeInstance.teacher_id ?? ''}><option value="">Not specified</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}</select></label>
                  <label>Duration, minutes<input className="input" name="duration_minutes" type="number" min="0" step="0.5" defaultValue={activeInstance.duration_seconds ? activeInstance.duration_seconds / 60 : ''} /></label>
                  <label>Audio URL<input className="input" name="audio_url" type="url" defaultValue={activeInstance.audio_url ?? ''} /></label>
                  <label>Start at seconds<input className="input" name="start_seconds" type="number" min="0" defaultValue={activeInstance.start_seconds ?? ''} /></label>
                  <label>End at seconds<input className="input" name="end_seconds" type="number" min="0" defaultValue={activeInstance.end_seconds ?? ''} /></label>
                </div>
                <label>Status<select className="input" name="status" defaultValue={activeInstance.status}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                <button className="button red" type="submit">Save version</button>
              </form>
            ) : modal.kind === 'edit-meditation' && activeMeditation ? (
              <div className="admin-course-modal-body">
                <form className="form-stack" action={updateMeditation.bind(null, activeMeditation.id)}>
                  <label>Name<input className="input" name="name" defaultValue={activeMeditation.name} required /></label>
                  <label>Description<textarea className="input" name="description" rows={4} defaultValue={activeMeditation.description ?? ''} /></label>
                  <label>Topics<input className="input" name="topics" defaultValue={(activeMeditation.topics ?? []).join(', ')} /></label>
                  <label>Status<select className="input" name="status" defaultValue={activeMeditation.status}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                  <div className="actions"><button className="button red" type="submit">Save meditation</button>{activeMeditation.status === 'published' ? <Link className="button" href={`/meditations/${activeMeditation.slug}`}>Student view</Link> : null}</div>
                </form>
                <div className="admin-course-offerings-list">
                  <div className="admin-course-offerings-head"><div><strong>Versions</strong><div className="meta">Every version keeps its source course/class relationship.</div></div><button className="button sage" type="button" onClick={() => setModal({ kind: 'create-version', meditationId: activeMeditation.id })}>+ Add version</button></div>
                  {instances.filter((instance) => instance.meditation_id === activeMeditation.id).map((instance) => (
                    <div className="meditation-version-row" key={instance.id}>
                      <div><strong>{instance.title || instance.sessions?.title || activeMeditation.name}</strong><small>{sourceLabel(instance.sessions)}{instance.audio_url ? ' · audio added' : ''}</small></div>
                      <button className="button" type="button" onClick={() => setModal({ kind: 'edit-version', id: instance.id })}>Edit</button>
                    </div>
                  ))}
                  {!instances.some((instance) => instance.meditation_id === activeMeditation.id) ? <p className="meta">No versions linked yet.</p> : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  )
}
