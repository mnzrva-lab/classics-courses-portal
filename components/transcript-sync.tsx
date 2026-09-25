'use client'

import { useEffect, useRef, useState } from 'react'

type Point = {
  id: string
  seconds: number
  element: HTMLElement
  timestamp: HTMLElement
}

function parseTimestamp(value: string) {
  const match = value.trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  if (minutes > 59 || seconds > 59) return null
  return hours * 3600 + minutes * 60 + seconds
}

function scanTranscript() {
  const points: Point[] = []
  const paragraphs = document.querySelectorAll<HTMLElement>('#transcript [id^="paragraph-"]')

  paragraphs.forEach((paragraph) => {
    const id = paragraph.id.replace(/^paragraph-/, '')
    const timestamp = paragraph.querySelector<HTMLElement>('.transcript-copy .transcript-timestamp, :scope > div .meta')
    if (!id || !timestamp) return
    const seconds = parseTimestamp(timestamp.textContent ?? '')
    if (seconds == null) return

    paragraph.dataset.transcriptParagraph = id
    paragraph.dataset.transcriptStart = String(seconds)
    timestamp.dataset.transcriptSeek = String(seconds)
    timestamp.classList.add('transcript-timestamp')
    timestamp.setAttribute('role', 'button')
    timestamp.setAttribute('tabindex', '0')
    timestamp.setAttribute('aria-label', `Play recording from ${timestamp.textContent?.trim() ?? 'this timestamp'}`)

    points.push({ id, seconds, element: paragraph, timestamp })
  })

  return points.sort((a, b) => a.seconds - b.seconds)
}

function activePoint(points: Point[], seconds: number) {
  let low = 0
  let high = points.length - 1
  let result: Point | null = null

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (points[middle].seconds <= seconds + 0.35) {
      result = points[middle]
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return result
}

export default function TranscriptSync() {
  const pointsRef = useRef<Point[]>([])
  const activeIdRef = useRef<string | null>(null)
  const followRef = useRef(false)
  const recordingAvailableRef = useRef(false)
  const [available, setAvailable] = useState(false)
  const [follow, setFollow] = useState(false)
  const [inTranscript, setInTranscript] = useState(false)

  useEffect(() => {
    followRef.current = follow
  }, [follow])

  useEffect(() => {
    function updateTranscriptPresence() {
      const transcript = document.getElementById('transcript')
      if (!transcript) {
        setInTranscript(false)
        return
      }
      const rect = transcript.getBoundingClientRect()
      setInTranscript(rect.top < window.innerHeight - 120 && rect.bottom > 120)
    }

    updateTranscriptPresence()
    window.addEventListener('scroll', updateTranscriptPresence, { passive: true })
    window.addEventListener('resize', updateTranscriptPresence)
    return () => {
      window.removeEventListener('scroll', updateTranscriptPresence)
      window.removeEventListener('resize', updateTranscriptPresence)
    }
  }, [])

  useEffect(() => {
    const active = available && inTranscript
    document.body.classList.toggle('transcript-sync-active', active)
    return () => document.body.classList.remove('transcript-sync-active')
  }, [available, inTranscript])

  useEffect(() => {
    function refreshPoints() {
      pointsRef.current = scanTranscript()
      if (!pointsRef.current.length) {
        activeIdRef.current = null
        recordingAvailableRef.current = false
        setAvailable(false)
      } else if (recordingAvailableRef.current) {
        setAvailable(true)
      }
    }

    refreshPoints()

    function seekFromElement(target: EventTarget | null) {
      const element = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-transcript-seek]') : null
      if (!element) return false
      const seconds = Number(element.dataset.transcriptSeek)
      if (!Number.isFinite(seconds)) return false
      window.dispatchEvent(new CustomEvent('recording-seek', { detail: { seconds } }))
      return true
    }

    function onClick(event: MouseEvent) {
      if (seekFromElement(event.target)) event.preventDefault()
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' && event.key !== ' ') return
      if (seekFromElement(event.target)) event.preventDefault()
    }

    function onRecordingTime(event: Event) {
      const seconds = (event as CustomEvent<{ seconds?: number }>).detail?.seconds
      if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return

      recordingAvailableRef.current = true
      if (!pointsRef.current.length) refreshPoints()
      if (!pointsRef.current.length) return
      setAvailable(true)

      const current = activePoint(pointsRef.current, seconds)
      if (!current || current.id === activeIdRef.current) return

      for (const point of pointsRef.current) {
        const isCurrent = point.id === current.id
        point.element.classList.toggle('is-current', isCurrent)
        if (isCurrent) point.element.setAttribute('aria-current', 'true')
        else point.element.removeAttribute('aria-current')
      }
      activeIdRef.current = current.id

      if (followRef.current) {
        const rect = current.element.getBoundingClientRect()
        const comfortablyVisible = rect.top >= 120 && rect.bottom <= window.innerHeight - 90
        if (!comfortablyVisible) current.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    let refreshTimer: number | null = null
    const observer = new MutationObserver(() => {
      if (refreshTimer != null) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(refreshPoints, 80)
    })
    observer.observe(document.body, { childList: true, subtree: true })

    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('recording-time', onRecordingTime)
    window.addEventListener('hashchange', refreshPoints)

    return () => {
      observer.disconnect()
      if (refreshTimer != null) window.clearTimeout(refreshTimer)
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('recording-time', onRecordingTime)
      window.removeEventListener('hashchange', refreshPoints)
      for (const point of pointsRef.current) {
        point.element.classList.remove('is-current')
        point.element.removeAttribute('aria-current')
      }
      pointsRef.current = []
      activeIdRef.current = null
      recordingAvailableRef.current = false
    }
  }, [])

  function jumpTo(id: 'recording' | 'transcript') {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!available || pointsRef.current.length === 0) return null

  return (
    <div className={inTranscript ? "transcript-sync-floating is-in-transcript" : "transcript-sync-floating"} aria-label="Video and transcript controls">
      <div className="transcript-sync-copy">
        <strong>Video + transcript sync</strong>
        <div className="meta">Click a timestamp to seek. Follow playback highlights the current passage.</div>
      </div>

      <div className="transcript-sync-mobile-nav" aria-label="Quick navigation">
        <button type="button" onClick={() => jumpTo('recording')}>↑ Video</button>
        <button type="button" onClick={() => jumpTo('transcript')}>↑ Transcript</button>
      </div>

      <button
        className={follow ? 'button sage transcript-sync-follow' : 'button transcript-sync-follow'}
        type="button"
        onClick={() => setFollow((value) => !value)}
        aria-pressed={follow}
      >
        {follow ? 'Following' : 'Follow'}
      </button>
    </div>
  )
}
