'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useSearchParams } from 'next/navigation'

type Entry = { key: string; title: string; subtitle: string; status: string; element: HTMLElement }
function eyebrow(section: HTMLElement) { return section.querySelector<HTMLElement>(':scope > .eyebrow')?.textContent?.trim() ?? '' }
function heading(section: HTMLElement) { return section.querySelector<HTMLElement>(':scope > h2')?.textContent?.trim() ?? '' }

export default function AdminOfferingSectionEnhancer() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const navigationKey = `${pathname}?${searchParams.toString()}`
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)

  useEffect(() => {
    if (!/^\/admin\/offerings\/[^/]+\/?$/.test(pathname)) return
    const main = document.querySelector<HTMLElement>('main.container.page')
    if (!main) return
    const sections = Array.from(main.querySelectorAll<HTMLElement>(':scope > section.section.card'))
    const core = sections.find((section) => eyebrow(section) === 'Course Offering')
    if (!core) return

    const transcriptBulk = sections.filter((section) => eyebrow(section) === 'Bulk import')[0]
    const notesBulk = sections.filter((section) => eyebrow(section) === 'Bulk import')[1]
    const materials = sections.find((section) => eyebrow(section) === 'Course Offering materials')
    const structure = sections.find((section) => eyebrow(section) === 'Program structure')
    const sessions = sections.find((section) => eyebrow(section) === 'Sessions')
    const addSession = sections.find((section) => eyebrow(section) === 'Add session')

    // New linked resources follow the archive default: Published inside the Course Offering.
    // Existing resources keep their stored status.
    if (materials) {
      for (const form of Array.from(materials.querySelectorAll<HTMLFormElement>('form'))) {
        const title = form.querySelector<HTMLInputElement>('input[name="material_title"]')
        const status = form.querySelector<HTMLSelectElement>('select[name="material_status"]')
        if (title && !title.value.trim() && status) status.value = 'published'
      }
    }

    const next: Entry[] = []
    if (materials) {
      const materialForms = materials.querySelectorAll('input[name="material_title"]').length
      next.push({ key: 'materials', title: 'Shared materials', subtitle: 'Course-wide readings, slides and files', status: materialForms > 1 ? `${materialForms - 1} resource${materialForms - 1 === 1 ? '' : 's'}` : 'No resources yet', element: materials })
    }
    if (structure) {
      const groupForms = structure.querySelectorAll('form').length
      next.push({ key: 'structure', title: heading(structure) || 'Program structure', subtitle: 'Terms, parts and modules', status: groupForms > 1 ? `${groupForms - 1} section${groupForms - 1 === 1 ? '' : 's'}` : 'Create first section', element: structure })
    }
    if (sessions) {
      const count = sessions.querySelectorAll('a[href^="/admin/sessions/"]').length
      next.push({ key: 'sessions', title: 'Sessions', subtitle: 'Classes, meditations, reviews and Q&A', status: `${count} session${count === 1 ? '' : 's'}`, element: sessions })
    }
    if (transcriptBulk) next.push({ key: 'transcripts', title: 'Bulk Reference Transcripts', subtitle: 'Import several transcript files together', status: 'Import tool', element: transcriptBulk })
    if (notesBulk) next.push({ key: 'notes', title: 'Bulk Study Notes', subtitle: 'Import several Study Notes files together', status: 'Import tool', element: notesBulk })
    if (addSession) next.push({ key: 'add-session', title: 'Add one session', subtitle: 'Use only when bulk/archive import is not appropriate', status: 'Manual creation', element: addSession })

    for (const item of next) item.element.classList.add('admin-offering-section-source')
    const cardsMount = document.createElement('div')
    cardsMount.className = 'admin-offering-section-cards-mount'
    const quickMount = main.querySelector<HTMLElement>('.admin-offering-quick-tools-mount')
    if (quickMount) quickMount.insertAdjacentElement('afterend', cardsMount)
    else core.insertAdjacentElement('afterend', cardsMount)
    setMount(cardsMount)
    setEntries(next)

    const cleanups: Array<() => void> = []
    for (const item of next) for (const form of Array.from(item.element.querySelectorAll<HTMLFormElement>('form'))) {
      const close = () => setActiveKey(null)
      form.addEventListener('submit', close)
      cleanups.push(() => form.removeEventListener('submit', close))
    }

    return () => {
      next.forEach((item) => item.element.classList.remove('admin-offering-section-source', 'is-open'))
      cleanups.forEach((cleanup) => cleanup())
      cardsMount.remove(); setMount(null); setEntries([]); setActiveKey(null); document.body.classList.remove('admin-modal-open')
    }
  }, [pathname, navigationKey])

  useEffect(() => {
    for (const entry of entries) entry.element.classList.toggle('is-open', entry.key === activeKey)
    document.body.classList.toggle('admin-modal-open', Boolean(activeKey))
  }, [entries, activeKey])

  useEffect(() => {
    if (!activeKey) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setActiveKey(null) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [activeKey])

  const cards = mount ? createPortal(
    <section className="admin-offering-section-cards" aria-label="Course Offering content managers">
      {entries.map((entry) => <article className="admin-offering-section-card" key={entry.key}><div><div className="eyebrow">{entry.title}</div><strong>{entry.subtitle}</strong><span className="meta">{entry.status}</span></div><button className="button" type="button" onClick={() => setActiveKey(entry.key)}>Open</button></article>)}
    </section>, mount,
  ) : null

  const active = entries.find((entry) => entry.key === activeKey)
  const modal = active ? createPortal(<><button className="admin-editor-backdrop" type="button" aria-label="Close section" onClick={() => setActiveKey(null)} /><div className="admin-editor-closebar admin-offering-closebar"><strong>{active.title}</strong><button className="button" type="button" onClick={() => setActiveKey(null)}>Close ×</button></div></>, document.body) : null
  return <>{cards}{modal}</>
}
