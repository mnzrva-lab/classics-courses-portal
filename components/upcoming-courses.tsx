'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import NextClassCountdown from '@/components/next-class-countdown'

type UpcomingSession = {
  id: string
  label: string
  date: string
  startsAt?: string | null
  endsAt?: string | null
}

type UpcomingCourse = {
  courseNumber: number
  title: string
  href: string
  artwork?: string | null
  sessions: UpcomingSession[]
}

function dateStart(value: string) {
  return new Date(`${value}T00:00:00`).getTime()
}

function dateEnd(value: string) {
  return new Date(`${value}T23:59:59`).getTime()
}

function sessionStart(session: UpcomingSession) {
  return session.startsAt ? new Date(session.startsAt).getTime() : dateStart(session.date)
}

function sessionEnd(session: UpcomingSession) {
  return session.endsAt ? new Date(session.endsAt).getTime() : dateEnd(session.date)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

export default function UpcomingCourses({ courses }: { courses: UpcomingCourse[] }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const featured = useMemo(() => {
    const candidates = courses.flatMap((course) => {
      const nextSession = course.sessions
        .filter((session) => sessionEnd(session) > now)
        .sort((a, b) => sessionStart(a) - sessionStart(b))[0]

      return nextSession ? [{ course, nextSession, startsAt: sessionStart(nextSession) }] : []
    })

    return candidates.sort((a, b) => a.startsAt - b.startsAt)[0] ?? null
  }, [courses, now])

  if (!featured) return null

  const { course, nextSession } = featured
  const exactSessions = course.sessions
    .filter((session): session is UpcomingSession & { startsAt: string; endsAt: string } => Boolean(session.startsAt && session.endsAt))
    .map((session) => ({ id: session.id, label: session.label, startsAt: session.startsAt, endsAt: session.endsAt }))

  const artworkStyle = course.artwork
    ? { backgroundImage: `linear-gradient(90deg, rgba(25,31,28,.78), rgba(25,31,28,.18)), url("${course.artwork}")` }
    : undefined

  return (
    <section className="container section upcoming-courses-section">
      <div className="section-head upcoming-feature-heading">
        <div>
          <div className="eyebrow">Upcoming courses</div>
          <h2>Study live next</h2>
          <p>The nearest scheduled course appears here automatically from the Library schedule.</p>
        </div>
      </div>

      <article className="upcoming-feature-card">
        <Link
          className={course.artwork ? 'upcoming-feature-artwork has-artwork' : 'upcoming-feature-artwork placeholder'}
          href={course.href}
          style={artworkStyle}
          aria-label={`Open Classics Course ${course.courseNumber}: ${course.title}`}
        >
          <div className="upcoming-feature-artwork-copy">
            <div className="upcoming-feature-course-label">Classics Course {course.courseNumber}</div>
            <h3>{course.title}</h3>
            <span>Live teaching schedule</span>
          </div>
        </Link>

        <div className="upcoming-feature-mobile-title">
          <div className="eyebrow">Classics Course {course.courseNumber}</div>
          <h3>{course.title}</h3>
        </div>

        <div className="upcoming-feature-details">
          <div className="upcoming-feature-calendar" aria-hidden="true">▦</div>

          <div className="upcoming-feature-next">
            {exactSessions.length ? (
              <NextClassCountdown sessions={exactSessions} />
            ) : (
              <div className="next-class-countdown">
                <div>
                  <span className="eyebrow">Next class</span>
                  <strong>{nextSession.label}</strong>
                </div>
                <div className="next-class-countdown-time">
                  <span>{formatDate(nextSession.date)}</span>
                </div>
              </div>
            )}
          </div>

          <Link className="button sage upcoming-feature-cta" href={course.href}>
            View course schedule →
          </Link>
        </div>
      </article>
    </section>
  )
}
