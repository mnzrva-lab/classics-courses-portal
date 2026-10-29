'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

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
  const paragraphs = document.querySelectorAll<HTMLElement>('#transcript [data-transcript-paragraph]')

  paragraphs.forEach((paragraph) => {
    const id = paragraph.id.replace(/^paragraph-/, '')
    const timestamp = paragraph.querySelector<HTMLElement>('.transcript-copy .transcript-timestamp, :scope > div .meta')
    if (!id || !timestamp) return
    const explicit = timestamp.getAttribute('data-transcript-seek')
    const numeric = explicit === null ? null : Number(explicit)
    const seconds = numeric !== null && Number.isFinite(numeric) && numeric >= 0
      ? numeric
      : parseTimestamp(timestamp.textContent ?? '')
    if (seconds == null) return

    paragraph.dataset.transcriptParagraph = id
    paragraph.dataset.transcriptStart = String(seconds)
    timestamp.dataset.transcriptSeek = String(seconds)
    timestamp.classList.add('transcript-timestamp')
    // Native buttons already handle keyboard activation; do not seek twice.
    if (!(timestamp instanceof HTMLButtonElement)) {
      timestamp.setAttribute('role', 'button')
      timestamp.setAttribute('tabindex', '0')
    }
    if (!timestamp.hasAttribute('aria-label')) {
      timestamp.setAttribute('aria-label', `Play recording from ${timestamp.textContent?.trim() ?? 'this timestamp'}`)
    }

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
  const pathname = usePathname()
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
      // Inactive study tabs and unavailable transcripts must not show navigation.
      if (!transcript || !transcript.querySelector('[data-library-transcript], [data-transcript-paragraph]') || transcript.getClientRects().length === 0) {
        setInTranscript(false)
        return
      }
      const rect = transcript.getBoundingClientRect()
      setInTranscript(rect.top < -200 && rect.bottom > 160)
    }

    updateTranscriptPresence()
    window.addEventListener('scroll', updateTranscriptPresence, { passive: true })
    window.addEventListener('resize', updateTranscriptPresence)
    // React tab switches can change the visible transcript without scrolling.
    const observer = new MutationObserver(updateTranscriptPresence)
    // Some class study tabs toggle the hidden attribute without remounting.
    // Observe those switches so a toolbar never stays over Study Notes.
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden'],
    })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', updateTranscriptPresence)
      window.removeEventListener('resize', updateTranscriptPresence)
    }
  }, [pathname])

  useEffect(() => {
    document.body.classList.toggle('transcript-sync-active', inTranscript)
    return () => document.body.classList.remove('transcript-sync-active')
  }, [inTranscript])

  useEffect(() => {
    // RootLayout survives client navigation: never carry Follow into a new class.
    pointsRef.current = []
    activeIdRef.current = null
    followRef.current = false
    recordingAvailableRef.current = false
    setAvailable(false)
    setFollow(false)

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
      if (event.target instanceof HTMLButtonElement) return
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
      if (!current) return

      if (current.id !== activeIdRef.current) {
        for (const point of pointsRef.current) {
          const isCurrent = point.id === current.id
          point.element.classList.toggle('is-current', isCurrent)
          if (isCurrent) point.element.setAttribute('aria-current', 'true')
          else point.element.removeAttribute('aria-current')
        }
        activeIdRef.current = current.id
      }

      // When Follow is enabled, respect it even if playback stays in the
      // same paragraph while the student has scrolled elsewhere.
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
  }, [pathname])

  function jumpTo(id: 'recording' | 'transcript') {
    // Visiting the player must not be undone by the next playback update.
    if (id === 'recording') {
      followRef.current = false
      setFollow(false)
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function toggleFollow() {
    const next = !followRef.current
    followRef.current = next
    setFollow(next)
    // If the student activates Follow after seeking, return to the passage
    // already highlighted instead of waiting for the next timestamp.
    if (!next) return
    const current = pointsRef.current.find(point => point.id === activeIdRef.current)
    if (current) {
      const rect = current.element.getBoundingClientRect()
      if (rect.top < 120 || rect.bottom > window.innerHeight - 90) {
        current.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  // Navigation works for every transcript. Follow requires a timed, connected player.
  if (!inTranscript) return null
  const canFollow = available && pointsRef.current.length > 0

  return (
    <nav
      className={'transcript-sync-floating is-in-transcript' + (canFollow ? ' has-follow' : '')}
      aria-label="Transcript and video navigation"
    >
      <button type="button" className="transcript-sync-transcript" onClick={() => jumpTo('transcript')}>↑ Transcript</button>
      <button type="button" className="transcript-sync-video" onClick={() => jumpTo('recording')}>↑ Video</button>
      {canFollow ? (
        <button
          className={'transcript-sync-follow' + (follow ? ' is-following' : '')}
          type="button"
          onClick={toggleFollow}
          aria-pressed={follow}
          aria-label={follow ? 'Turn off Follow playback' : 'Turn on Follow playback'}
          title="Automatically scroll to the current passage while the recording plays"
        >
          {follow ? 'Follow on' : 'Follow off'}
        </button>
      ) : null}
    </nav>
  )
}
