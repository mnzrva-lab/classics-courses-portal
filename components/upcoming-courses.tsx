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
  sessions: UpcomingSession[]
}

function dateOnlyEnd(value: string) {
  return new Date(`${value}T23:59:59`).getTime()
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
}

export default function UpcomingCourses({ courses }: { courses: UpcomingCourse[] }) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const upcoming = useMemo(() => {
    if (now == null) return courses
    return courses.filter((course) => course.sessions.some((session) => {
      if (session.endsAt) return new Date(session.endsAt).getTime() > now
      return dateOnlyEnd(session.date) > now
    }))
  }, [courses, now])

  if (!upcoming.length) return null

  return (
    <section className="container section upcoming-courses-section">
      <div className="section-head">
        <div>
          <div className="eyebrow">Upcoming courses</div>
          <h2>Study live next</h2>
          <p>Future courses appear here automatically when schedule data is added to the Library.</p>
        </div>
      </div>

      <div className="upcoming-course-grid">
        {upcoming.map((course) => {
          const exactSessions = course.sessions
            .filter((session): session is UpcomingSession & { startsAt: string; endsAt: string } => Boolean(session.startsAt && session.endsAt))
            .map((session) => ({ id: session.id, label: session.label, startsAt: session.startsAt, endsAt: session.endsAt }))
          const firstFuture = now == null
            ? course.sessions[0]
            : course.sessions.find((session) => session.endsAt ? new Date(session.endsAt).getTime() > now : dateOnlyEnd(session.date) > now)

          return (
            <article className="upcoming-course-card" key={course.courseNumber}>
              <div className="eyebrow">Classics Course {course.courseNumber}</div>
              <h3>{course.title}</h3>
              {exactSessions.length ? (
                <NextClassCountdown sessions={exactSessions} />
              ) : firstFuture ? (
                <p className="upcoming-course-next"><strong>{firstFuture.label}</strong><span>{formatDate(firstFuture.date)}</span></p>
              ) : null}
              <Link className="inline-library-link" href={course.href}>View course schedule →</Link>
            </article>
          )
        })}
      </div>
    </section>
  )
}
