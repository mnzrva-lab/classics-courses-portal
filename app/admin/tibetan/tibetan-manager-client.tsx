'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { bulkUpdateTibetanTerms, createTibetanTerm, extractTibetanTermsFromSession, updateTibetanTerm } from './actions'

type Term = {
  id: string
  slug: string
  transliteration: string
  english_meaning: string
  explanation: string | null
  aliases: string[] | null
  status: string
  sort_order: number
}

type SessionOption = { id: string; code: string | null; title: string }
type Modal = { kind: 'create' } | { kind: 'edit'; id: string } | null

export default function TibetanManagerClient({ terms, sessions }: { terms: Term[]; sessions: SessionOption[] }) {
  const [modal, setModal] = useState<Modal>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const active = useMemo(() => modal?.kind === 'edit' ? terms.find((term) => term.id === modal.id) ?? null : null, [modal, terms])
  const selectedIds = Array.from(selected)
  const allSelected = terms.length > 0 && selected.size === terms.length

  useEffect(() => {
    document.body.classList.toggle('admin-modal-open', Boolean(modal))
    if (!modal) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setModal(null) }
    window.addEventListener('keydown', close)
    return () => { window.removeEventListener('keydown', close); document.body.classList.remove('admin-modal-open') }
  }, [modal])

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(terms.map((term) => term.id)))
  }

  return (
    <>
      <section className="admin-course-create-card">
        <div>
          <div className="eyebrow">New term</div>
          <strong>Add a glossary term</strong>
          <p className="meta">Keep one clean term record: transliteration, English meaning, explanation, alternate forms, and teaching sources.</p>
        </div>
        <button className="button red" type="button" onClick={() => setModal({ kind: 'create' })}>+ Add term</button>
      </section>

      <section className="admin-tibetan-extractor">
        <div className="eyebrow">Transcript detection</div>
        <h2 style={{ fontSize: 28, marginBottom: 4 }}>Find bracketed Tibetan terms</h2>
        <p className="meta">Scans a transcript for uppercase bracketed transliterations such as <strong>[THABS MKHAS]</strong>. New terms are Draft only. Existing terms get the exact transcript passage added as another source.</p>
        <form action={extractTibetanTermsFromSession}>
          <label>Source class
            <select className="input" name="session_id" required defaultValue="">
              <option value="" disabled>Select a class with a transcript</option>
              {sessions.map((session) => <option key={session.id} value={session.id}>{session.code ? `${session.code} · ` : ''}{session.title}</option>)}
            </select>
          </label>
          <button className="button sage" type="submit">Detect terms</button>
        </form>
      </section>

      <section className="section admin-course-catalog-section">
        <div className="eyebrow">Glossary entries</div>
        <h2>{terms.length} term{terms.length === 1 ? '' : 's'}</h2>

        {terms.length ? <div className="admin-tibetan-review-toolbar">
          <button className="button" type="button" onClick={toggleAll}>{allSelected ? 'Clear all' : 'Select all'}</button>
          <span className="meta">{selected.size ? `${selected.size} selected` : 'Select terms to publish or archive together'}</span>
          <form action={bulkUpdateTibetanTerms}>
            <input type="hidden" name="term_ids" value={selectedIds.join(',')} />
            <input type="hidden" name="status" value="published" />
            <button className="button sage" type="submit" disabled={!selected.size}>Publish selected</button>
          </form>
          <form action={bulkUpdateTibetanTerms}>
            <input type="hidden" name="term_ids" value={selectedIds.join(',')} />
            <input type="hidden" name="status" value="archived" />
            <button className="button" type="submit" disabled={!selected.size}>Archive selected</button>
          </form>
        </div> : null}

        <div className="admin-tibetan-review-grid">
          {terms.map((term) => {
            const needsMeaningReview = term.english_meaning.toLowerCase().startsWith('review meaning:')
            const isSelected = selected.has(term.id)
            return (
              <article className={isSelected ? 'admin-tibetan-term-card is-selected' : 'admin-tibetan-term-card'} key={term.id}>
                <div className="admin-tibetan-term-card-head">
                  <label className="admin-tibetan-select"><input type="checkbox" checked={isSelected} onChange={() => toggleSelected(term.id)} /> Select</label>
                  <span className={`admin-tibetan-status ${term.status}`}>{term.status}</span>
                </div>
                <strong>{term.transliteration}</strong>
                <span className="meta">{term.english_meaning}</span>
                {needsMeaningReview ? <span className="admin-tibetan-needs-review">Review English meaning before publishing</span> : null}
                <button className="button" type="button" onClick={() => setModal({ kind: 'edit', id: term.id })}>Edit</button>
              </article>
            )
          })}
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
                <label>Alternate forms<input className="input" name="aliases" defaultValue={(active?.aliases ?? []).join(', ')} placeholder="Comma-separated alternate forms" /></label>
                <label>Status
                  <select className="input" name="status" defaultValue={active?.status ?? 'draft'}>
                    <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
                  </select>
                </label>
                <label>Sort order<input className="input" name="sort_order" type="number" defaultValue={active?.sort_order ?? 0} /></label>
              </div>
              <label>Explanation<textarea className="input" name="explanation" rows={5} defaultValue={active?.explanation ?? ''} /></label>
              <div className="actions">
                <button className="button red" type="submit">{modal.kind === 'create' ? 'Create Draft' : 'Save term'}</button>
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
