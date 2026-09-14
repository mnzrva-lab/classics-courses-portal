'use client'

import { useEffect, useState } from 'react'

export default function TranscriptQuickNav({ transcriptId = 'transcript', recordingId = 'recording' }: { transcriptId?: string; recordingId?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function update() {
      const transcript = document.getElementById(transcriptId)
      if (!transcript) {
        setVisible(false)
        return
      }
      const rect = transcript.getBoundingClientRect()
      setVisible(rect.top < -220 && rect.bottom > 160)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [transcriptId])

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!visible) return null

  return (
    <nav className="transcript-quick-nav" aria-label="Transcript quick navigation">
      <button type="button" onClick={() => goTo(transcriptId)}>↑ Transcript</button>
      <button type="button" onClick={() => goTo(recordingId)}>↑ Video</button>
    </nav>
  )
}
