'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

type SessionCard = {
  id: string
  href: string
  code: string
  title: string
  sessionType: string
  sessionDate: string | null
  teacherNames: string[]
  completed: boolean
  inProgress: boolean
  badges: string[]
}

function dateLabel(value: string | null) {
  if (!value) return 'Date to be added'
  const date = new Date(`${value}T12:00:00Z`)
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export default function OfferingSessionList({ sessions }: { sessions: SessionCard[] }) {
  const hasClasses = sessions.some((item) => item.sessionType === 'class')
  const hasMeditations = sessions.some((item) => item.sessionType === 'meditation')
  const [filter, setFilter] = useState<'all' | 'class' | 'meditation'>('all')
  const visible = useMemo(() => filter === 'all' ? sessions : sessions.filter((item) => item.sessionType === filter), [filter, sessions])

  return (
    <>
      {hasClasses && hasMeditations ? (
        <div className="content-filter" aria-label="Course content filter">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          <button type="button" className={filter === 'class' ? 'active' : ''} onClick={() => setFilter('class')}>Classes</button>
          <button type="button" className={filter === 'meditation' ? 'active' : ''} onClick={() => setFilter('meditation')}>Meditations</button>
        </div>
      ) : null}

      <div className="materials-list-real">
        {visible.map((session) => (
          <Link className={session.completed ? 'material-module completed' : session.inProgress ? 'material-module in-progress' : 'material-module'} href={session.href} key={session.id}>
            <span className="material-module-code">{session.code}</span>
            <span className="material-module-copy">
              <strong>{session.title}</strong>
              <small>{session.teacherNames.join(', ')}{session.teacherNames.length ? ' · ' : ''}{dateLabel(session.sessionDate)}</small>
            </span>
            <span className="material-module-badges">
              {session.badges.map((badge) => <span className="availability" key={badge}>{badge}</span>)}
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
