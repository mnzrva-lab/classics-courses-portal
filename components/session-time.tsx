'use client'

import { useMemo, useState } from 'react'

function formatDateTime(value: string, timeZone?: string | null) {
  return new Intl.DateTimeFormat(undefined, {
    ...(timeZone ? { timeZone } : {}),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function SessionTime({ startsAt, sourceTimezone }: { startsAt: string | null; sourceTimezone: string | null }) {
  const [showSource, setShowSource] = useState(false)
  const localTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time', [])

  if (!startsAt) return <span>Time to be added</span>

  const text = showSource && sourceTimezone
    ? formatDateTime(startsAt, sourceTimezone)
    : formatDateTime(startsAt)

  return (
    <span>
      {text}
      <span style={{ marginLeft: 8, opacity: 0.72 }}>{showSource && sourceTimezone ? sourceTimezone : localTimezone}</span>
      {sourceTimezone && sourceTimezone !== localTimezone ? (
        <button
          type="button"
          onClick={() => setShowSource((value) => !value)}
          style={{ marginLeft: 8, border: 0, background: 'transparent', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}
        >
          {showSource ? 'Show local time' : 'Show source time'}
        </button>
      ) : null}
    </span>
  )
}
