'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Session = {
  id: string
  code: string | null
  title: string
  starts_at: string | null
  ends_at: string | null
  zoom_url: string | null
  course_title: string
  offering_label: string | null
  teacher_names: string[]
}

type UpcomingOffering = {
  href: string
  course_label: string
  course_title: string
  offering_label: string | null
  starts_on: string | null
}

function localDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function offeringDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function countdown(ms: number) {
  if (ms <= 0) return 'Starting now'
  const minutes = Math.ceil(ms / 60000)
  if (minutes < 60) return `Starts in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours < 24) return `Starts in ${hours}h${remainder ? ` ${remainder}m` : ''}`
  const days = Math.floor(hours / 24)
  return `Starts in ${days} day${days === 1 ? '' : 's'}`
}

export default function NextSessionCard({
  sessions,
  upcomingOffering = null,
}: {
  sessions: Session[]
  upcomingOffering?: UpcomingOffering | null
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  const current = useMemo(() => {
    const valid = sessions
      .filter((session) => session.starts_at && session.ends_at)
      .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())

    const live = valid.find((session) => {
      const start = new Date(session.starts_at!).getTime()
      const end = new Date(session.ends_at!).getTime()
      return now >= start && now <= end
    })

    if (live) return live
    return valid.find((session) => new Date(session.starts_at!).getTime() > now) ?? null
  }, [sessions, now])

  if (!current || !current.starts_at || !current.ends_at) {
    if (upcomingOffering?.starts_on) {
      return (
        <div className="next-card">
          <div className="next-line">
            <div className="next-session-copy">
              <div className="eyebrow">NEXT COURSE</div>
              <h3>{upcomingOffering.course_label}{upcomingOffering.offering_label ? ` · ${upcomingOffering.offering_label}` : ''}</h3>
              <div className="meta">{upcomingOffering.course_title} · begins {offeringDate(upcomingOffering.starts_on)}</div>
              <div className="meta" style={{ marginTop: 4 }}>Individual live class times have not been added yet.</div>
            </div>
            <div className="next-session-action">
              <Link className="button" href={upcomingOffering.href}>Open course</Link>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="next-card">
        <div className="eyebrow">Next live session</div>
        <h3>No live session is scheduled yet.</h3>
        <div className="meta">When a published class has a date, start time, and end time, it will appear here automatically.</div>
      </div>
    )
  }

  const start = new Date(current.starts_at).getTime()
  const end = new Date(current.ends_at).getTime()
  const isLive = now >= start && now <= end
  const zoomOpen = now >= start - 15 * 60 * 1000 && now <= end

  return (
    <div className="next-card">
      <div className="next-line">
        <div className="next-session-copy">
          <div className={isLive ? 'live' : 'eyebrow'}>{isLive ? 'LIVE NOW' : 'NEXT CLASS'}</div>
          <h3>{current.course_title} · {current.code || current.title}</h3>
          <div className="meta">
            {current.offering_label ? `${current.offering_label} · ` : ''}
            {current.teacher_names.join(', ')}
          </div>
          <div style={{ marginTop: 8, fontWeight: 750 }}>{localDateTime(current.starts_at)} · your local time</div>
          {!isLive && <div className="meta" style={{ marginTop: 4 }}>{countdown(start - now)}</div>}
        </div>
        {zoomOpen && current.zoom_url ? (
          <div className="next-session-action">
            <a className="button red" href={current.zoom_url} target="_blank" rel="noreferrer">
              Join the class on Zoom
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}
