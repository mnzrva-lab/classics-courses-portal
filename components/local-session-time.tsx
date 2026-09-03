'use client'

import { useEffect, useState } from 'react'

type Props = {
  startsAt: string
  endsAt: string
  rebroadcastAt?: string | null
  sourceTimezone: string
  sourceLabel: string
  compact?: boolean
}

type TimeLabels = {
  local: string
  source: string
  rebroadcast: string | null
  zone: string
}

function formatDateTime(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value))
}

function formatTime(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value))
}

function formatRange(start: string, end: string, timeZone?: string) {
  return `${formatDateTime(start, timeZone)}–${formatTime(end, timeZone)}`
}

export default function LocalSessionTime({ startsAt, endsAt, rebroadcastAt, sourceTimezone, sourceLabel, compact = false }: Props) {
  const [labels, setLabels] = useState<TimeLabels | null>(null)

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time'
    setLabels({
      local: formatRange(startsAt, endsAt),
      source: formatRange(startsAt, endsAt, sourceTimezone),
      rebroadcast: rebroadcastAt ? formatDateTime(rebroadcastAt) : null,
      zone,
    })
  }, [startsAt, endsAt, rebroadcastAt, sourceTimezone])

  if (!labels) return <div className="meta">Loading your local time…</div>

  if (compact) {
    return (
      <div className="local-session-compact">
        <strong>{labels.local}</strong>
        <div className="meta">{labels.zone}</div>
        <div className="meta">{sourceLabel}: {labels.source}{labels.rebroadcast ? ` · Rebroadcast: ${labels.rebroadcast}` : ''}</div>
      </div>
    )
  }

  return (
    <div>
      <strong>{labels.local}</strong>
      <div className="meta">Your timezone · {labels.zone}</div>
      <div className="meta">Source: {labels.source} · {sourceLabel}</div>
      {labels.rebroadcast ? <div className="meta">Rebroadcast: {labels.rebroadcast} · your local time</div> : null}
    </div>
  )
}
