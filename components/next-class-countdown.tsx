'use client'

import { useEffect, useMemo, useState } from 'react'

type Session = {
  id: string
  label: string
  startsAt: string
  endsAt: string
}

function countdownLabel(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`)
  if (hours || days) parts.push(`${hours} hr`)
  if (!days) parts.push(`${minutes} min`)
  return parts.join(' ')
}

function localLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function NextClassCountdown({ sessions }: { sessions: Session[] }) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const timer = window.setInterval(update, 30000)
    return () => window.clearInterval(timer)
  }, [])

  const state = useMemo(() => {
    if (now == null) return null
    const active = sessions.find((session) => new Date(session.startsAt).getTime() <= now && new Date(session.endsAt).getTime() > now)
    if (active) return { kind: 'live' as const, session: active, diff: new Date(active.endsAt).getTime() - now }
    const next = sessions.find((session) => new Date(session.startsAt).getTime() > now)
    if (!next) return { kind: 'done' as const }
    return { kind: 'next' as const, session: next, diff: new Date(next.startsAt).getTime() - now }
  }, [now, sessions])

  if (!state) return <div className="next-class-countdown"><strong>Next class</strong><span>Calculating local time…</span></div>
  if (state.kind === 'done') return <div className="next-class-countdown"><strong>Course schedule complete</strong></div>
  if (state.kind === 'live') {
    return <div className="next-class-countdown live-now"><strong>{state.session.label} is happening now</strong><span>Ends in {countdownLabel(state.diff)}</span></div>
  }

  return (
    <div className="next-class-countdown">
      <div><span className="eyebrow">Next class</span><strong>{state.session.label}</strong></div>
      <div className="next-class-countdown-time"><b>Starts in {countdownLabel(state.diff)}</b><span>{localLabel(state.session.startsAt)} · your local time</span></div>
    </div>
  )
}
