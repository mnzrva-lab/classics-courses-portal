'use client'

import { useEffect, useMemo, useState } from 'react'

type SyncPoint = {
  id: string
  seconds: number
}

type TranscriptSyncProps = {
  enabled: boolean
  points: SyncPoint[]
}

type TranscriptTimestampProps = {
  seconds: number
  label: string
  enabled: boolean
}

export function TranscriptTimestamp({ seconds, label, enabled }: TranscriptTimestampProps) {
  if (!enabled) return <span className="meta transcript-time-static">{label}</span>

  function seek() {
    window.dispatchEvent(new CustomEvent('recording-seek', { detail: { seconds } }))
  }

  return (
    <button
      className="transcript-timestamp"
      type="button"
      onClick={seek}
      title={`Play recording from ${label}`}
      aria-label={`Play recording from ${label}`}
    >
      {label}
    </button>
  )
}

export default function TranscriptSync({ enabled, points }: TranscriptSyncProps) {
  const orderedPoints = useMemo(
    () => [...points].sort((a, b) => a.seconds - b.seconds),
    [points],
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const [followPlayback, setFollowPlayback] = useState(false)

  useEffect(() => {
    if (!enabled || orderedPoints.length === 0) return

    function onRecordingTime(event: Event) {
      const seconds = (event as CustomEvent<{ seconds?: number }>).detail?.seconds
      if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return

      let nextId: string | null = null
      for (const point of orderedPoints) {
        if (point.seconds > seconds + 0.35) break
        nextId = point.id
      }
      setActiveId(nextId)
    }

    window.addEventListener('recording-time', onRecordingTime)
    return () => window.removeEventListener('recording-time', onRecordingTime)
  }, [enabled, orderedPoints])

  useEffect(() => {
    const paragraphs = document.querySelectorAll<HTMLElement>('[data-transcript-paragraph]')
    paragraphs.forEach((element) => {
      const isCurrent = Boolean(activeId) && element.dataset.transcriptParagraph === activeId
      element.classList.toggle('is-current', isCurrent)
      if (isCurrent) element.setAttribute('aria-current', 'true')
      else element.removeAttribute('aria-current')
    })

    if (followPlayback && activeId) {
      const active = document.querySelector<HTMLElement>(`[data-transcript-paragraph="${CSS.escape(activeId)}"]`)
      active?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeId, followPlayback])

  useEffect(() => () => {
    document.querySelectorAll<HTMLElement>('[data-transcript-paragraph]').forEach((element) => {
      element.classList.remove('is-current')
      element.removeAttribute('aria-current')
    })
  }, [])

  if (!enabled || orderedPoints.length === 0) return null

  return (
    <div className="note transcript-sync-controls">
      <div>
        <strong>Synced with the recording</strong>
        <div className="meta">Click a timestamp to jump to that moment. While the YouTube recording plays, the nearest timestamped paragraph is highlighted.</div>
      </div>
      <button
        className={followPlayback ? 'button sage' : 'button'}
        type="button"
        onClick={() => setFollowPlayback((value) => !value)}
        aria-pressed={followPlayback}
      >
        {followPlayback ? 'Following playback' : 'Follow playback'}
      </button>
    </div>
  )
}
