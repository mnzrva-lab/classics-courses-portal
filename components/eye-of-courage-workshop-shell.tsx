'use client'

import { useEffect, useRef, useState } from 'react'
import EyeOfCourageWorkshop from './eye-of-courage-workshop'

export default function EyeOfCourageWorkshopShell() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [showMini, setShowMini] = useState(false)
  const [saveStatus, setSaveStatus] = useState('Ready to save locally')

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const notice = root.querySelector('.eoc-workshop-toolbar') as HTMLElement | null
    const status = notice?.querySelector('.eoc-local-status small') as HTMLElement | null

    const update = () => {
      setShowMini(Boolean(notice && notice.getBoundingClientRect().bottom < 92))
      const text = status?.textContent?.trim()
      if (text) setSaveStatus(text)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)

    const observer = status ? new MutationObserver(update) : null
    observer?.observe(status!, { childList: true, subtree: true, characterData: true })

    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [])

  function backToDownloads() {
    const notice = rootRef.current?.querySelector('.eoc-workshop-toolbar') as HTMLElement | null
    notice?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div ref={rootRef} className="eoc-workshop-shell">
      <EyeOfCourageWorkshop />
      {showMini ? (
        <div className="eoc-workshop-sticky-mini" aria-label="Workbook save status">
          <span>{saveStatus}</span>
          <button className="button" type="button" onClick={backToDownloads}>Back to downloads</button>
        </div>
      ) : null}
    </div>
  )
}
