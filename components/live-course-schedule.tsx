'use client'

import { useEffect, useMemo, useState } from 'react'

type Session = {
  id: string
  code: string | null
  title: string
  startsAt: string | null
  endsAt: string | null
  sourceTimezone: string | null
  zoomUrl: string | null
  teacherNames: string[]
}

function localDay(value: string) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}

function time(value: string, timeZone?: string | null) {
  return new Intl.DateTimeFormat(undefined, {
    ...(timeZone ? { timeZone } : {}),
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function timeRange(session: Session, timeZone?: string | null) {
  if (!session.startsAt) return 'Time to be added'
  const start = time(session.startsAt, timeZone)
  return session.endsAt ? `${start}–${time(session.endsAt, timeZone)}` : start
}

function dayLabel(value: string, timeZone?: string | null) {
  return new Intl.DateTimeFormat(undefined, {
    ...(timeZone ? { timeZone } : {}),
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export default function LiveCourseSchedule({
  sessions,
  calendarHref,
}: {
  sessions: Session[]
  calendarHref: string
}) {
  const [now, setNow] = useState(() => Date.now())
  const [showSource, setShowSource] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  const sorted = useMemo(() => sessions
    .filter((session) => session.startsAt)
    .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime()), [sessions])

  const todayKey = localDay(new Date(now).toISOString())
  const todaySessions = sorted.filter((session) => session.startsAt && localDay(session.startsAt) === todayKey)
  const visible = showAll ? sorted : todaySessions
  const localTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Your timezone', [])

  return (
    <section className="live-course-card">
      <div className="live-course-head">
        <div>
          <div className="eyebrow">Live course schedule</div>
          <h2>{showAll ? 'Full schedule' : 'Today'}</h2>
          <p className="meta">Times are shown in your local timezone by default.</p>
        </div>
        <div className="time-switch" aria-label="Schedule timezone">
          <button type="button" className={!showSource ? 'active' : ''} onClick={() => setShowSource(false)}>Your time</button>
          <button type="button" className={showSource ? 'active' : ''} onClick={() => setShowSource(true)}>Source time</button>
        </div>
      </div>

      <div className="live-course-rows">
        {visible.length ? visible.map((session) => {
          const start = session.startsAt ? new Date(session.startsAt).getTime() : 0
          const end = session.endsAt ? new Date(session.endsAt).getTime() : start + 2 * 60 * 60 * 1000
          const zoomOpen = Boolean(session.zoomUrl) && now >= start - 15 * 60 * 1000 && now <= end
          const primaryZone = showSource ? session.sourceTimezone : null
          const secondaryZone = showSource ? null : session.sourceTimezone
          return (
            <div className={zoomOpen ? 'live-course-row zoom-open' : 'live-course-row'} key={session.id}>
              <strong className="live-course-time">
                {showAll && session.startsAt ? <small>{dayLabel(session.startsAt, primaryZone)}</small> : null}
                {timeRange(session, primaryZone)}
              </strong>
              <div className="live-course-copy">
                <strong>{session.code || session.title}</strong>
                <div className="meta">
                  {session.teacherNames.join(', ')}
                  {session.startsAt && secondaryZone ? ` · ${timeRange(session, secondaryZone)} ${secondaryZone}` : ''}
                  {!showSource && !secondaryZone ? ` · ${localTimezone}` : ''}
                </div>
              </div>
              {zoomOpen ? <a className="live-course-zoom" href={session.zoomUrl!} target="_blank" rel="noreferrer">Zoom ↗</a> : null}
            </div>
          )
        }) : (
          <div className="live-course-empty">No published sessions are scheduled for today.</div>
        )}
      </div>

      <div className="live-course-actions">
        <button type="button" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Show today' : 'View full schedule'}</button>
        <a href={calendarHref}>＋ Add schedule to calendar</a>
      </div>
    </section>
  )
}
