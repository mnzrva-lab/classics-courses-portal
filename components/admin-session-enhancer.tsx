'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useSearchParams } from 'next/navigation'

type EditorKey = 'details' | 'notes' | 'materials' | 'transcript'

type EditorState = { key: EditorKey; title: string; status: string; element: HTMLElement }

function statusFromSection(section: HTMLElement, fieldName: string) {
  const select = section.querySelector<HTMLSelectElement>(`select[name="${fieldName}"]`)
  return select?.value || 'missing'
}
function directEyebrow(section: HTMLElement) {
  return section.querySelector<HTMLElement>(':scope > .eyebrow')?.textContent ?? section.querySelector<HTMLElement>('.eyebrow')?.textContent ?? ''
}
function materialStatus(section: HTMLElement) {
  const titleInputs = section.querySelectorAll<HTMLInputElement>('input[name="material_title"]').length
  const count = Math.max(0, titleInputs - 2)
  return count ? `${count} resource${count === 1 ? '' : 's'}` : 'No resources yet'
}

export default function AdminSessionEnhancer() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const navigationKey = `${pathname}?${searchParams.toString()}`
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const [editors, setEditors] = useState<EditorState[]>([])
  const [activeKey, setActiveKey] = useState<EditorKey | null>(null)
  const activeEditor = useMemo(() => editors.find((item) => item.key === activeKey) ?? null, [editors, activeKey])

  useEffect(() => {
    if (!/^\/admin\/sessions\/[^/]+\/?$/.test(pathname)) return
    const main = document.querySelector<HTMLElement>('main.container.page')
    if (!main) return
    const sections = Array.from(main.querySelectorAll<HTMLElement>('section.section.card'))
    const details = sections.find((section) => directEyebrow(section).includes('Session details'))
    const notes = sections.find((section) => directEyebrow(section).includes('Study Notes'))
    const materials = sections.find((section) => directEyebrow(section).includes('Class materials'))
    const transcript = sections.find((section) => directEyebrow(section).includes('Reference Transcript'))
    if (!details || !notes || !materials || !transcript) return

    // Archive workflow defaults: new content is Published inside the usually-Draft Course Offering.
    // Existing content keeps its saved status.
    const notesContent = notes.querySelector<HTMLTextAreaElement>('textarea[name="study_notes_content"]')
    const transcriptContent = transcript.querySelector<HTMLTextAreaElement>('textarea[name="transcript_content"]')
    const notesStatusSelect = notes.querySelector<HTMLSelectElement>('select[name="study_notes_status"]')
    const transcriptStatusSelect = transcript.querySelector<HTMLSelectElement>('select[name="transcript_status"]')
    if (!notesContent?.value.trim() && notesStatusSelect) notesStatusSelect.value = 'published'
    if (!transcriptContent?.value.trim() && transcriptStatusSelect) transcriptStatusSelect.value = 'published'
    for (const form of Array.from(materials.querySelectorAll<HTMLFormElement>('form'))) {
      const title = form.querySelector<HTMLInputElement>('input[name="material_title"]')
      const status = form.querySelector<HTMLSelectElement>('select[name="material_status"]')
      if (title && !title.value.trim() && status) status.value = 'published'
    }

    const editorStates: EditorState[] = [
      { key: 'details', title: '1 · Session details', status: statusFromSection(details, 'status'), element: details },
      { key: 'notes', title: '2 · Study Notes', status: notesContent?.value.trim() ? statusFromSection(notes, 'study_notes_status') : 'missing', element: notes },
      { key: 'materials', title: '3 · Class materials', status: materialStatus(materials), element: materials },
      { key: 'transcript', title: '4 · Reference Transcript', status: transcriptContent?.value.trim() ? statusFromSection(transcript, 'transcript_status') : 'missing', element: transcript },
    ]

    for (const editor of editorStates) { editor.element.classList.add('admin-editor-source'); editor.element.setAttribute('tabindex', '-1') }
    const compactMount = document.createElement('div')
    compactMount.className = 'admin-editor-cards-mount'
    details.parentElement?.insertBefore(compactMount, details)
    setMount(compactMount)
    setEditors(editorStates)

    const lead = main.querySelector<HTMLElement>(':scope > .lead')
    const bottomActions = Array.from(main.querySelectorAll<HTMLElement>('.section .actions')).find((actions) => {
      const text = actions.textContent ?? ''
      return text.includes('Back to admin') && text.includes('Open Course Offering')
    })
    let topNav: HTMLElement | null = null
    if (lead && bottomActions) {
      topNav = document.createElement('div')
      topNav.className = 'actions admin-session-top-actions'
      for (const link of Array.from(bottomActions.querySelectorAll('a'))) topNav.appendChild(link.cloneNode(true))
      lead.insertAdjacentElement('afterend', topNav)
    }

    const pickerCleanups: Array<() => void> = []
    for (const label of Array.from(main.querySelectorAll<HTMLLabelElement>('label.button'))) {
      if (!label.textContent?.includes('Import DOCX / MD / TXT')) continue
      const input = label.querySelector<HTMLInputElement>('input[type="file"]')
      if (!input || label.dataset.importEnhanced === '1') continue
      label.dataset.importEnhanced = '1'
      label.setAttribute('role', 'button')
      label.setAttribute('tabindex', '0')
      const openPicker = (event: Event) => { if (event.target === input) return; event.preventDefault(); input.click() }
      const openWithKeyboard = (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') openPicker(event) }
      label.addEventListener('click', openPicker)
      label.addEventListener('keydown', openWithKeyboard)
      pickerCleanups.push(() => { label.removeEventListener('click', openPicker); label.removeEventListener('keydown', openWithKeyboard) })
    }

    const submitCleanups: Array<() => void> = []
    for (const editor of editorStates) {
      for (const form of Array.from(editor.element.querySelectorAll<HTMLFormElement>('form'))) {
        const closeOnSubmit = () => setActiveKey(null)
        form.addEventListener('submit', closeOnSubmit)
        submitCleanups.push(() => form.removeEventListener('submit', closeOnSubmit))
      }
    }

    return () => {
      for (const editor of editorStates) { editor.element.classList.remove('admin-editor-source', 'is-open'); editor.element.removeAttribute('tabindex') }
      pickerCleanups.forEach((cleanup) => cleanup())
      submitCleanups.forEach((cleanup) => cleanup())
      compactMount.remove(); topNav?.remove(); setMount(null); setEditors([]); setActiveKey(null); document.body.classList.remove('admin-modal-open')
    }
  }, [pathname, navigationKey])

  useEffect(() => {
    for (const editor of editors) editor.element.classList.toggle('is-open', editor.key === activeKey)
    document.body.classList.toggle('admin-modal-open', Boolean(activeKey))
    if (activeEditor) window.requestAnimationFrame(() => activeEditor.element.focus({ preventScroll: true }))
  }, [activeKey, activeEditor, editors])

  useEffect(() => {
    if (!activeKey) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setActiveKey(null) }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [activeKey])

  const cards = mount ? createPortal(
    <section className="admin-editor-cards" aria-label="Session editors">
      {editors.map((editor) => (
        <div className="admin-editor-card" key={editor.key}>
          <div><div className="eyebrow">{editor.title}</div><strong>{editor.status === 'missing' ? 'Not added yet' : editor.status}</strong></div>
          <button className="button" type="button" onClick={() => setActiveKey(editor.key)}>Edit</button>
        </div>
      ))}
    </section>, mount,
  ) : null

  const modal = activeEditor ? createPortal(
    <><button className="admin-editor-backdrop" type="button" aria-label="Close editor" onClick={() => setActiveKey(null)} /><div className="admin-editor-closebar"><strong>{activeEditor.title}</strong><button className="button" type="button" onClick={() => setActiveKey(null)}>Close ×</button></div></>, document.body,
  ) : null

  return <>{cards}{modal}</>
}
