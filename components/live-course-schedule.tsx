'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  const sorted = useMemo(() => sessions
    .filter((session) => session.startsAt)
    .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime()), [sessions])

  const todayKey = localDay(new Date(now).toISOString())
  const todaySessions = sorted.filter((session) => session.startsAt && localDay(session.startsAt) === todayKey)
  const localTimezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Your timezone', [])

  function timezoneSwitch(className = 'time-switch') {
    return (
      <div className={className} aria-label="Schedule timezone">
        <button type="button" className={!showSource ? 'active' : ''} onClick={() => setShowSource(false)}>Your time</button>
        <button type="button" className={showSource ? 'active' : ''} onClick={() => setShowSource(true)}>Source time</button>
      </div>
    )
  }

  function scheduleRows(rows: Session[], fullSchedule = false) {
    if (!rows.length) return <div className="live-course-empty">No published sessions are scheduled for today.</div>

    return rows.map((session) => {
      const start = session.startsAt ? new Date(session.startsAt).getTime() : 0
      const end = session.endsAt ? new Date(session.endsAt).getTime() : start + 2 * 60 * 60 * 1000
      const zoomOpen = Boolean(session.zoomUrl) && now >= start - 15 * 60 * 1000 && now <= end
      const primaryZone = showSource ? session.sourceTimezone : null
      const secondaryZone = showSource ? null : session.sourceTimezone
      return (
        <div className={zoomOpen ? 'live-course-row zoom-open' : 'live-course-row'} key={session.id}>
          <strong className="live-course-time">
            {fullSchedule && session.startsAt ? <small>{dayLabel(session.startsAt, primaryZone)}</small> : null}
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
    })
  }

  return (
    <>
      <section className="live-course-card">
        <div className="live-course-head">
          <div>
            <div className="eyebrow">Live course schedule</div>
            <h2>Today</h2>
            <p className="meta">Times are shown in your local timezone by default.</p>
          </div>
          {timezoneSwitch()}
        </div>

        <div className="live-course-rows">
          {scheduleRows(todaySessions)}
        </div>

        <div className="live-course-actions">
          <button className="live-course-action-button" type="button" onClick={() => dialogRef.current?.showModal()}>View full schedule</button>
          <a className="live-course-action-button" href={calendarHref}>＋ Add to calendar</a>
        </div>
      </section>

      <dialog className="schedule-dialog" ref={dialogRef}>
        <div className="schedule-dialog-shell">
          <div className="schedule-dialog-head">
            <div>
              <div className="eyebrow">Live course schedule</div>
              <h2>Full schedule</h2>
              <p className="meta">Switch between your timezone and the original teaching timezone.</p>
            </div>
            <button className="schedule-dialog-close" type="button" aria-label="Close full schedule" onClick={() => dialogRef.current?.close()}>×</button>
          </div>

          {timezoneSwitch('time-switch schedule-dialog-time-switch')}
          <div className="live-course-rows schedule-dialog-rows">{scheduleRows(sorted, true)}</div>

          <div className="schedule-dialog-actions">
            <a className="button sage" href={calendarHref}>＋ Add schedule to calendar</a>
            <button className="button" type="button" onClick={() => dialogRef.current?.close()}>Close</button>
          </div>
        </div>
      </dialog>
    </>
  )
}
