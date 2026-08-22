'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createProgram, updateCourse } from './actions'

type Offering = {
  id: string
  slug: string
  label: string
  status: string
  sort_order: number | null
}

type Course = {
  id: string
  kind: string
  canonical_number: number | null
  slug: string
  title: string
  subtitle: string | null
  description: string | null
  status: string
  sort_order: number | null
  course_offerings: Offering[] | null
}

type ModalState = { kind: 'create' } | { kind: 'edit'; courseId: string } | null

function typeLabel(kind: string) {
  if (kind === 'classics') return 'Classics Course'
  if (kind === 'living_lam_rim') return 'Living Lam Rim'
  if (kind === 'book') return 'Text Study'
  return 'Other Program'
}

export default function CourseCatalogClient({ courses }: { courses: Course[] }) {
  const [modal, setModal] = useState<ModalState>(null)
  const activeCourse = useMemo(
    () => modal?.kind === 'edit' ? courses.find((course) => course.id === modal.courseId) ?? null : null,
    [courses, modal],
  )

  useEffect(() => {
    document.body.classList.toggle('admin-modal-open', Boolean(modal))
    if (!modal) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.classList.remove('admin-modal-open')
    }
  }, [modal])

  return (
    <>
      <section className="admin-course-create-card">
        <div>
          <div className="eyebrow">New course or program</div>
          <strong>Create a text study or other program</strong>
          <p className="meta">For another version of a Classics Course, open that course below and add a Course Offering instead.</p>
        </div>
        <button className="button red" type="button" onClick={() => setModal({ kind: 'create' })}>+ Create new</button>
      </section>

      <section className="section admin-course-catalog-section">
        <div className="eyebrow">Catalog</div>
        <h2>Existing courses and programs</h2>
        <div className="admin-course-list">
          {courses.map((course) => {
            const offerings = [...(course.course_offerings ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            return (
              <article className="admin-course-row" key={course.id}>
                <div className="admin-course-row-copy">
                  <div className="eyebrow">{typeLabel(course.kind)}{course.canonical_number ? ` ${course.canonical_number}` : ''}</div>
                  <strong>{course.title}</strong>
                  <span className="meta">{course.status} · {offerings.length} Course Offering{offerings.length === 1 ? '' : 's'}</span>
                </div>
                <button className="button" type="button" onClick={() => setModal({ kind: 'edit', courseId: course.id })}>Manage</button>
              </article>
            )
          })}
        </div>
      </section>

      {modal ? (
        <div className="admin-catalog-modal-root" role="presentation">
          <button className="admin-editor-backdrop" type="button" aria-label="Close editor" onClick={() => setModal(null)} />
          <section className="admin-catalog-modal" role="dialog" aria-modal="true" aria-label={modal.kind === 'create' ? 'Create course or program' : `Manage ${activeCourse?.title ?? 'course'}`}>
            <header className="admin-catalog-modal-head">
              <div>
                <div className="eyebrow">{modal.kind === 'create' ? 'New course or program' : typeLabel(activeCourse?.kind ?? 'other')}</div>
                <h2>{modal.kind === 'create' ? 'Create a course or program' : activeCourse?.title}</h2>
              </div>
              <button className="admin-dialog-close" type="button" onClick={() => setModal(null)} aria-label="Close">×</button>
            </header>

            {modal.kind === 'create' ? (
              <form className="form-stack" action={createProgram}>
                <div className="grid two">
                  <label>Type
                    <select className="input" name="kind" defaultValue="other">
                      <option value="other">Other Program</option>
                      <option value="book">Text Study</option>
                    </select>
                  </label>
                  <label>Status
                    <select className="input" name="status" defaultValue="draft">
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                </div>
                <label>Title<input className="input" name="title" required placeholder="Program title" /></label>
                <label>Subtitle<input className="input" name="subtitle" placeholder="Optional" /></label>
                <label>URL slug<input className="input" name="slug" placeholder="Optional" /></label>
                <label>Description<textarea className="input" name="description" rows={5} placeholder="What students should know about this program" /></label>
                <div className="actions"><button className="button red" type="submit">Create</button><button className="button" type="button" onClick={() => setModal(null)}>Cancel</button></div>
              </form>
            ) : activeCourse ? (
              <div className="admin-course-modal-body">
                <form className="form-stack" action={updateCourse.bind(null, activeCourse.id)}>
                  {activeCourse.kind === 'classics' || activeCourse.kind === 'living_lam_rim' ? (
                    <div className="note">
                      <strong>Canonical identity protected</strong>
                      <div className="meta">Title, number, type, and URL slug stay stable. Subtitle, description, and visibility can still be edited.</div>
                    </div>
                  ) : (
                    <>
                      <div className="grid two">
                        <label>Type
                          <select className="input" name="kind" defaultValue={activeCourse.kind}>
                            <option value="other">Other Program</option>
                            <option value="book">Text Study</option>
                          </select>
                        </label>
                        <label>URL slug<input className="input" name="slug" defaultValue={activeCourse.slug} /></label>
                      </div>
                      <label>Title<input className="input" name="title" defaultValue={activeCourse.title} required /></label>
                    </>
                  )}
                  <label>Subtitle<input className="input" name="subtitle" defaultValue={activeCourse.subtitle ?? ''} /></label>
                  <label>Description<textarea className="input" name="description" rows={4} defaultValue={activeCourse.description ?? ''} /></label>
                  <label>Status
                    <select className="input" name="status" defaultValue={activeCourse.status}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                  <div className="actions"><button className="button red" type="submit">Save course</button></div>
                </form>

                <div className="admin-course-offerings-list">
                  <div className="admin-course-offerings-head">
                    <div><strong>Course Offerings</strong><div className="meta">Different versions or teaching periods of this course.</div></div>
                    <Link className="button sage" href={`/admin/offerings/new?course=${activeCourse.id}`}>+ Add Course Offering</Link>
                  </div>
                  {[...(activeCourse.course_offerings ?? [])]
                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .map((offering) => (
                      <div className="admin-course-offering-row" key={offering.id}>
                        <span>{offering.label} <small>{offering.status}</small></span>
                        <Link className="button" href={`/admin/offerings/${offering.id}`}>Manage</Link>
                      </div>
                    ))}
                  {!activeCourse.course_offerings?.length ? <p className="meta">No Course Offerings yet.</p> : null}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  )
}
