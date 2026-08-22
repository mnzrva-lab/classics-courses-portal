'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createTibetanTerm, updateTibetanTerm } from './actions'

type Term = {
  id: string
  slug: string
  tibetan_script: string | null
  transliteration: string
  english_meaning: string
  explanation: string | null
  aliases: string[] | null
  status: string
  sort_order: number
}

type Modal = { kind: 'create' } | { kind: 'edit'; id: string } | null

export default function TibetanManagerClient({ terms }: { terms: Term[] }) {
  const [modal, setModal] = useState<Modal>(null)
  const active = useMemo(() => modal?.kind === 'edit' ? terms.find((term) => term.id === modal.id) ?? null : null, [modal, terms])

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
        <div>
          <div className="eyebrow">New term</div>
          <strong>Add a Tibetan glossary term</strong>
          <p className="meta">Student pages use transliteration. Tibetan script can still be stored here as source/reference data.</p>
        </div>
        <button className="button red" type="button" onClick={() => setModal({ kind: 'create' })}>+ Add term</button>
      </section>

      <section className="section admin-course-catalog-section">
        <div className="eyebrow">Glossary entries</div>
        <h2>{terms.length} term{terms.length === 1 ? '' : 's'}</h2>
        <div className="admin-course-list">
          {terms.map((term) => (
            <article className="admin-course-row" key={term.id}>
              <div className="admin-course-row-copy">
                <div className="eyebrow">{term.status}</div>
                <strong>{term.transliteration}</strong>
                <span className="meta">{term.english_meaning}</span>
              </div>
              <button className="button" type="button" onClick={() => setModal({ kind: 'edit', id: term.id })}>Edit</button>
            </article>
          ))}
          {!terms.length ? <div className="card"><p className="meta">No glossary terms yet.</p></div> : null}
        </div>
      </section>

      {modal ? (
        <div className="admin-catalog-modal-root" role="presentation">
          <button className="admin-editor-backdrop" type="button" aria-label="Close term editor" onClick={() => setModal(null)} />
          <section className="admin-catalog-modal" role="dialog" aria-modal="true" aria-label={modal.kind === 'create' ? 'Add Tibetan term' : `Edit ${active?.transliteration ?? 'term'}`}>
            <header className="admin-catalog-modal-head">
              <div><div className="eyebrow">Tibetan glossary</div><h2>{modal.kind === 'create' ? 'Add term' : active?.transliteration}</h2></div>
              <button className="admin-dialog-close" type="button" onClick={() => setModal(null)} aria-label="Close">×</button>
            </header>

            <form className="form-stack" action={modal.kind === 'create' ? createTibetanTerm : updateTibetanTerm.bind(null, active!.id, active!.slug)}>
              <div className="grid two">
                <label>Transliteration<input className="input" name="transliteration" required defaultValue={active?.transliteration ?? ''} /></label>
                <label>English meaning<input className="input" name="english_meaning" required defaultValue={active?.english_meaning ?? ''} /></label>
                <label>Tibetan script<input className="input" name="tibetan_script" defaultValue={active?.tibetan_script ?? ''} placeholder="Optional source data" /></label>
                <label>Aliases<input className="input" name="aliases" defaultValue={(active?.aliases ?? []).join(', ')} placeholder="Comma-separated alternate forms" /></label>
                <label>Status
                  <select className="input" name="status" defaultValue={active?.status ?? 'published'}>
                    <option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
                  </select>
                </label>
                <label>Sort order<input className="input" name="sort_order" type="number" defaultValue={active?.sort_order ?? 0} /></label>
              </div>
              <label>Explanation<textarea className="input" name="explanation" rows={5} defaultValue={active?.explanation ?? ''} /></label>
              <div className="actions">
                <button className="button red" type="submit">{modal.kind === 'create' ? 'Create term' : 'Save term'}</button>
                {active ? <Link className="button sage" href={`/admin/tibetan/${active.id}`}>Manage sources</Link> : null}
                {active?.status === 'published' ? <Link className="button" href={`/tibetan/${active.slug}`}>Open term</Link> : null}
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  )
}
