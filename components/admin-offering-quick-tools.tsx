'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import ArtworkUploadForm from '@/app/admin/offerings/[id]/artwork-upload-form'
import PlaylistCsvImport from '@/app/admin/offerings/[id]/playlist-csv-import'
import BulkSessionEditor from '@/app/admin/offerings/[id]/bulk-session-editor'

export default function AdminOfferingQuickTools() {
  const pathname = usePathname()
  const match = pathname.match(/^\/admin\/offerings\/([^/]+)$/)
  const offeringId = match?.[1] ?? null
  const [mount, setMount] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!offeringId) {
      setMount(null)
      return
    }

    const main = document.querySelector<HTMLElement>('main.container.page')
    if (!main) return

    const sections = Array.from(main.querySelectorAll<HTMLElement>('section.section.card'))
    const offeringSection = sections.find((section) => section.querySelector<HTMLElement>(':scope > .eyebrow')?.textContent?.trim() === 'Course Offering')
    const target = offeringSection ?? sections[0] ?? null
    const compactMount = document.createElement('div')
    compactMount.className = 'admin-offering-quick-tools-mount'
    if (target) target.insertAdjacentElement('afterend', compactMount)
    else main.appendChild(compactMount)
    setMount(compactMount)

    const cleanups: Array<() => void> = []
    const labels = Array.from(main.querySelectorAll<HTMLLabelElement>('label.button'))

    for (const label of labels) {
      const text = label.textContent ?? ''
      if (!text.includes('Select transcript files') && !text.includes('Select Study Notes files')) continue
      const input = label.querySelector<HTMLInputElement>('input[type="file"]')
      if (!input) continue
      label.setAttribute('role', 'button')
      label.setAttribute('tabindex', '0')
      const openPicker = (event: Event) => {
        if (event.target === input) return
        event.preventDefault()
        input.click()
      }
      const openWithKeyboard = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        openPicker(event)
      }
      label.addEventListener('click', openPicker)
      label.addEventListener('keydown', openWithKeyboard)
      cleanups.push(() => {
        label.removeEventListener('click', openPicker)
        label.removeEventListener('keydown', openWithKeyboard)
      })
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup())
      compactMount.remove()
      setMount(null)
    }
  }, [pathname, offeringId])

  if (!offeringId || !mount) return null

  return createPortal(
    <aside className="admin-offering-quick-tools admin-offering-tools-grid admin-offering-tools-three" aria-label="Course Offering tools">
      <div className="admin-offering-tool">
        <div>
          <div className="eyebrow">Course artwork</div>
          <strong>Visual identity</strong>
          <p className="meta">Upload or replace the artwork used by this Course Offering.</p>
        </div>
        <ArtworkUploadForm offeringId={offeringId} />
      </div>

      <div className="admin-offering-tool">
        <div>
          <div className="eyebrow">Recordings</div>
          <strong>Import recordings</strong>
          <p className="meta">Match videos to sessions, or create a Draft class list automatically for an archive Course Offering.</p>
        </div>
        <PlaylistCsvImport offeringId={offeringId} />
      </div>

      <div className="admin-offering-tool">
        <div>
          <div className="eyebrow">Sessions</div>
          <strong>Bulk edit</strong>
          <p className="meta">Change titles, types, dates, teachers and statuses without opening every class separately.</p>
        </div>
        <BulkSessionEditor offeringId={offeringId} />
      </div>
    </aside>,
    mount,
  )
}
