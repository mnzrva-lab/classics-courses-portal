'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'

type Tab = 'transcript' | 'study-notes'

export default function ClassStudyTabs() {
  const pathname = usePathname()
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const [active, setActive] = useState<Tab>('transcript')
  const [panels, setPanels] = useState<{ transcript: HTMLElement; notes: HTMLElement } | null>(null)

  useEffect(() => {
    if (!/^\/courses\/[^/]+\/[^/]+\/[^/]+\/?$/.test(pathname)) return

    const transcript = document.getElementById('transcript')
    const notes = document.getElementById('study-notes')
    if (!transcript || !notes) return

    const tabMount = document.createElement('div')
    tabMount.className = 'class-study-tabs-mount'
    notes.parentElement?.insertBefore(tabMount, notes)

    transcript.classList.add('class-study-tab-panel')
    notes.classList.add('class-study-tab-panel')
    setPanels({ transcript, notes })
    setMount(tabMount)

    const chooseFromHash = () => {
      const hash = window.location.hash
      if (hash === '#study-notes') setActive('study-notes')
      else if (hash === '#transcript' || hash.startsWith('#paragraph-')) setActive('transcript')
    }
    chooseFromHash()
    window.addEventListener('hashchange', chooseFromHash)

    return () => {
      window.removeEventListener('hashchange', chooseFromHash)
      transcript.hidden = false
      notes.hidden = false
      transcript.classList.remove('class-study-tab-panel')
      notes.classList.remove('class-study-tab-panel')
      tabMount.remove()
      setPanels(null)
      setMount(null)
    }
  }, [pathname])

  useEffect(() => {
    if (!panels) return
    panels.transcript.hidden = active !== 'transcript'
    panels.notes.hidden = active !== 'study-notes'
  }, [active, panels])

  function select(tab: Tab) {
    setActive(tab)
    const hash = tab === 'transcript' ? '#transcript' : '#study-notes'
    if (window.history?.replaceState) window.history.replaceState(null, '', hash)
  }

  if (!mount) return null

  return createPortal(
    <div className="class-study-tabs" role="tablist" aria-label="Class study content">
      <button
        className={active === 'transcript' ? 'class-study-tab active' : 'class-study-tab'}
        type="button"
        role="tab"
        aria-selected={active === 'transcript'}
        onClick={() => select('transcript')}
      >
        Reference Transcript
      </button>
      <button
        className={active === 'study-notes' ? 'class-study-tab active' : 'class-study-tab'}
        type="button"
        role="tab"
        aria-selected={active === 'study-notes'}
        onClick={() => select('study-notes')}
      >
        Study Notes
      </button>
    </div>,
    mount,
  )
}
