'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type Session = {
  id: string
  slug: string
  code: string | null
  title: string
  starts_at: string | null
  ends_at: string | null
  course_title: string
  course_label: string
  course_slug: string
  offering_label: string | null
  offering_slug: string
  teacher_names: string[]
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function localTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export default function HomeTodayCard({ sessions }: { sessions: Session[] }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [])

  const { rows, isToday } = useMemo(() => {
    const nowDate = new Date(now)
    const valid = sessions
      .filter((session) => session.starts_at && session.ends_at)
      .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())

    const today = valid.filter((session) => sameLocalDay(new Date(session.starts_at!), nowDate))
    if (today.length) return { rows: today.slice(0, 5), isToday: true }

    const future = valid.filter((session) => new Date(session.ends_at!).getTime() >= now)
    return { rows: future.slice(0, 4), isToday: false }
  }, [sessions, now])

  return (
    <section className="home-today-card" aria-label={isToday ? "Today's sessions" : 'Next sessions'}>
      <div className="eyebrow">{isToday ? 'Today' : 'Coming up'}</div>
      <h2>{isToday ? "Today's sessions" : 'Next sessions'}</h2>

      <div className="home-event-list">
        {rows.length ? rows.map((session) => {
          const start = new Date(session.starts_at!).getTime()
          const end = new Date(session.ends_at!).getTime()
          const live = now >= start && now <= end
          const done = now > end
          const href = `/courses/${session.course_slug}/${session.offering_slug}/${session.slug}`
          return (
            <div className="home-event-row" key={session.id}>
              <div className="home-event-time">{localTime(session.starts_at!)}</div>
              <div className="home-event-copy">
                <Link href={href}>{session.code || session.title}</Link>
                <div>{session.course_label}{session.teacher_names.length ? ` · ${session.teacher_names.join(', ')}` : ''}</div>
              </div>
              <span className={live ? 'home-event-status live' : 'home-event-status'}>{live ? 'Live' : done ? 'Done' : 'Upcoming'}</span>
            </div>
          )
        }) : <p className="meta">No published sessions are scheduled yet.</p>}
      </div>
    </section>
  )
}
