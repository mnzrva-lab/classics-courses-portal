'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'

type EditorKey = 'notes' | 'transcript'

type EditorState = {
  key: EditorKey
  title: string
  status: string
  element: HTMLElement
}

function statusFromSection(section: HTMLElement, fieldName: string) {
  const select = section.querySelector<HTMLSelectElement>(`select[name="${fieldName}"]`)
  return select?.value || 'missing'
}

export default function AdminSessionEnhancer() {
  const pathname = usePathname()
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const [editors, setEditors] = useState<EditorState[]>([])
  const [activeKey, setActiveKey] = useState<EditorKey | null>(null)

  const activeEditor = useMemo(() => editors.find((item) => item.key === activeKey) ?? null, [editors, activeKey])

  useEffect(() => {
    if (!/^\/admin\/sessions\/[^/]+\/?$/.test(pathname)) return
    const main = document.querySelector<HTMLElement>('main.container.page')
    if (!main) return

    const sections = Array.from(main.querySelectorAll<HTMLElement>('section.section.card'))
    const notes = sections.find((section) => section.querySelector('.eyebrow')?.textContent?.includes('Study Notes'))
    const transcript = sections.find((section) => section.querySelector('.eyebrow')?.textContent?.includes('Reference Transcript'))
    if (!notes || !transcript) return

    notes.classList.add('admin-editor-source')
    transcript.classList.add('admin-editor-source')

    const compactMount = document.createElement('div')
    compactMount.className = 'admin-editor-cards-mount'
    notes.parentElement?.insertBefore(compactMount, notes)
    setMount(compactMount)
    setEditors([
      { key: 'notes', title: 'Study Notes', status: statusFromSection(notes, 'study_notes_status'), element: notes },
      { key: 'transcript', title: 'Reference Transcript', status: statusFromSection(transcript, 'transcript_status'), element: transcript },
    ])

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

    // Replace label-only file pickers with an explicit button trigger. This is more reliable
    // in Safari and inside the modal editor than a hidden input nested inside a label.
    for (const label of Array.from(main.querySelectorAll<HTMLLabelElement>('label.button'))) {
      if (!label.textContent?.includes('Import DOCX / MD / TXT')) continue
      const input = label.querySelector<HTMLInputElement>('input[type="file"]')
      if (!input || label.dataset.importEnhanced === '1') continue
      label.dataset.importEnhanced = '1'
      label.setAttribute('role', 'button')
      label.setAttribute('tabindex', '0')
      const openPicker = (event: Event) => {
        if (event.target === input) return
        event.preventDefault()
        input.click()
      }
      label.addEventListener('click', openPicker)
      label.addEventListener('keydown', (event) => {
        const keyboard = event as KeyboardEvent
        if (keyboard.key === 'Enter' || keyboard.key === ' ') openPicker(event)
      })
    }

    return () => {
      notes.classList.remove('admin-editor-source', 'is-open')
      transcript.classList.remove('admin-editor-source', 'is-open')
      compactMount.remove()
      topNav?.remove()
      setMount(null)
      setEditors([])
      setActiveKey(null)
      document.body.classList.remove('admin-modal-open')
    }
  }, [pathname])

  useEffect(() => {
    for (const editor of editors) editor.element.classList.toggle('is-open', editor.key === activeKey)
    document.body.classList.toggle('admin-modal-open', Boolean(activeKey))
  }, [activeKey, editors])

  const cards = mount ? createPortal(
    <section className="admin-editor-cards" aria-label="Session text content">
      {editors.map((editor) => (
        <div className="admin-editor-card" key={editor.key}>
          <div>
            <div className="eyebrow">{editor.title}</div>
            <strong>{editor.status === 'missing' ? 'Not added yet' : editor.status}</strong>
          </div>
          <button className="button" type="button" onClick={() => setActiveKey(editor.key)}>Edit</button>
        </div>
      ))}
    </section>,
    mount,
  ) : null

  const modal = activeEditor ? createPortal(
    <>
      <button className="admin-editor-backdrop" type="button" aria-label="Close editor" onClick={() => setActiveKey(null)} />
      <div className="admin-editor-closebar">
        <strong>{activeEditor.title}</strong>
        <button className="button" type="button" onClick={() => setActiveKey(null)}>Close ×</button>
      </div>
    </>,
    document.body,
  ) : null

  return <>{cards}{modal}</>
}
