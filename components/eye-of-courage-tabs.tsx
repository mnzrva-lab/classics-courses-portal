'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'

type TabId = 'transcript' | 'study-notes' | 'workshop'
type Tab = { id: TabId; label: string; panel: ReactNode }

type Props = {
  transcript: ReactNode
  studyNotes?: ReactNode
  workshop?: ReactNode
}

export default function EyeOfCourageTabs({ transcript, studyNotes, workshop }: Props) {
  const tabs = useMemo<Tab[]>(() => [
    { id: 'transcript', label: 'Reference Transcript', panel: transcript },
    ...(studyNotes ? [{ id: 'study-notes' as const, label: 'Study Notes', panel: studyNotes }] : []),
    ...(workshop ? [{ id: 'workshop' as const, label: 'Workshop', panel: workshop }] : []),
  ], [transcript, studyNotes, workshop])

  const [active, setActive] = useState<TabId>('transcript')

  useEffect(() => {
    const chooseFromHash = () => {
      const hash = window.location.hash.replace('#', '') as TabId
      if (tabs.some((tab) => tab.id === hash)) setActive(hash)
    }
    chooseFromHash()
    window.addEventListener('hashchange', chooseFromHash)
    return () => window.removeEventListener('hashchange', chooseFromHash)
  }, [tabs])

  function select(id: TabId) {
    setActive(id)
    if (window.history?.replaceState) window.history.replaceState(null, '', `#${id}`)
  }

  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]

  return (
    <section className="section eoc-class-study">
      <div className="class-study-tabs eoc-class-tabs" role="tablist" aria-label="Class study content">
        {tabs.map((tab) => (
          <button
            className={active === tab.id ? 'class-study-tab active' : 'class-study-tab'}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`eoc-panel-${tab.id}`}
            key={tab.id}
            onClick={() => select(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div id={`eoc-panel-${current.id}`} role="tabpanel" aria-label={current.label} className="eoc-tab-panel">
        {current.panel}
      </div>
    </section>
  )
}
