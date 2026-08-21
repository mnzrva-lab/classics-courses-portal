'use client'

import { useEffect, useRef, useState } from 'react'
import { googleDriveFileId, youtubeId } from '@/lib/recording'

type Props = {
  recordingUrl: string | null
  title: string
}

type YouTubePlayer = {
  destroy: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  playVideo: () => void
  getCurrentTime: () => number
}

type YouTubeApi = {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YouTubePlayer
  PlayerState: { PLAYING: number }
}

declare global {
  interface Window {
    YT?: YouTubeApi
  }
}

let youtubeApiPromise: Promise<YouTubeApi> | null = null

function loadYouTubeApi() {
  if (youtubeApiPromise) return youtubeApiPromise

  youtubeApiPromise = new Promise<YouTubeApi>((resolve) => {
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.head.appendChild(script)
    }

    const waitForApi = () => {
      if (window.YT?.Player) resolve(window.YT)
      else window.setTimeout(waitForApi, 100)
    }
    waitForApi()
  })

  return youtubeApiPromise
}

export default function RecordingPlayer({ recordingUrl, title }: Props) {
  const playerHostRef = useRef<HTMLDivElement | null>(null)
  const [youtubeReady, setYoutubeReady] = useState(false)
  const videoId = youtubeId(recordingUrl)
  const driveId = googleDriveFileId(recordingUrl)

  useEffect(() => {
    if (!videoId || !playerHostRef.current) return

    let disposed = false
    let player: YouTubePlayer | null = null
    let timer: number | null = null

    function publishTime() {
      if (!player) return
      const seconds = player.getCurrentTime()
      if (Number.isFinite(seconds)) {
        window.dispatchEvent(new CustomEvent('recording-time', { detail: { seconds } }))
      }
    }

    function stopTimer() {
      if (timer != null) window.clearInterval(timer)
      timer = null
    }

    function startTimer() {
      stopTimer()
      publishTime()
      timer = window.setInterval(publishTime, 500)
    }

    function onSeek(event: Event) {
      if (!player) return
      const seconds = (event as CustomEvent<{ seconds?: number }>).detail?.seconds
      if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return
      player.seekTo(Math.max(0, seconds), true)
      player.playVideo()
      publishTime()
    }

    window.addEventListener('recording-seek', onSeek)

    loadYouTubeApi().then((api) => {
      if (disposed || !playerHostRef.current) return
      player = new api.Player(playerHostRef.current, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: () => {
            if (disposed) return
            setYoutubeReady(true)
            publishTime()
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === api.PlayerState.PLAYING) startTimer()
            else {
              stopTimer()
              publishTime()
            }
          },
        },
      })
    })

    return () => {
      disposed = true
      setYoutubeReady(false)
      stopTimer()
      window.removeEventListener('recording-seek', onSeek)
      player?.destroy()
    }
  }, [videoId])

  if (!recordingUrl) return <p className="meta">Recording coming soon.</p>

  if (videoId) {
    return (
      <div>
        <div className="recording-frame">
          <div ref={playerHostRef} />
        </div>
        <div className="actions">
          <a className="button" href={recordingUrl} target="_blank" rel="noreferrer">Open recording in a new tab</a>
          {youtubeReady ? <span className="pill">Transcript sync ready</span> : null}
        </div>
      </div>
    )
  }

  if (driveId) {
    return (
      <div>
        <div className="recording-frame">
          <iframe
            src={`https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`}
            title={`${title} recording`}
            loading="lazy"
            allow="autoplay; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <div className="actions"><a className="button" href={recordingUrl} target="_blank" rel="noreferrer">Open recording in a new tab</a></div>
      </div>
    )
  }

  return <a className="button red" href={recordingUrl} target="_blank" rel="noreferrer">Open recording</a>
}
