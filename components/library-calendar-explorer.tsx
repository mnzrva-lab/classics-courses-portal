'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export type LiveCalendarEvent = {
  id: string
  title: string
  number: number
  href: string
  startsAt: string
  endsAt: string
}

export type LiveCalendarCourse = {
  id: string
  label: string
  shortLabel: string
  title: string
  artwork: string
  artworkAlt: string
  href: string
  calendarHref?: string
  startsAt: string
  endsAt: string | null
  cadence: string
  scheduleNote: string
  palette: 'classics' | 'lamrim'
  events: LiveCalendarEvent[]
}

type CourseState = { label: string; key: 'ongoing' | 'upcoming' | 'finished' }
type View = 'list' | 'calendar'
type TimePreference = 'local' | 'arizona'
const ARIZONA_ZONE = 'America/Phoenix'

function dayKey(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso))
  const find = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return find('year') + '-' + find('month') + '-' + find('day')
}

function dayLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', month: 'short', day: 'numeric',
  }).format(new Date(iso))
}

function fullDayLabel(key: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(key + 'T12:00:00Z'))
}

function shortTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

function timeRange(event: LiveCalendarEvent, zone: string) {
  return shortTime(event.startsAt, zone) + ' – ' + shortTime(event.endsAt, zone)
}

function formatMonth(key: string) {
  const parts = key.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', month: 'long', year: 'numeric',
  }).format(new Date(Date.UTC(parts[0], parts[1] - 1, 1)))
}

function changeMonth(key: string, offset: number) {
  const parts = key.split('-').map(Number)
  const date = new Date(Date.UTC(parts[0], parts[1] - 1 + offset, 1))
  return date.toISOString().slice(0, 7)
}

function status(course: LiveCalendarCourse, now: number, zone: string): CourseState {
  if (Date.parse(course.startsAt) > now) {
    return { key: 'upcoming', label: 'Starts ' + dayLabel(course.startsAt, zone) }
  }
  if (course.endsAt && Date.parse(course.endsAt) < now) {
    return { key: 'finished', label: 'Finished' }
  }
  return { key: 'ongoing', label: 'Ongoing' }
}

type CalendarEntry = { event: LiveCalendarEvent; course: LiveCalendarCourse }

function countdownForCourse(course: LiveCalendarCourse, now: number, zone: string) {
  const live = course.events.find((event) =>
    Date.parse(event.startsAt) <= now && Date.parse(event.endsAt) > now,
  )
  if (live) return {
    label: 'Class happening now',
    date: dayLabel(live.startsAt, zone) + ' · ' + shortTime(live.startsAt, zone),
  }

  const next = course.events
    .filter((event) => Date.parse(event.startsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]
  if (!next) return { label: 'No upcoming classes listed', date: '' }

  const remaining = Date.parse(next.startsAt) - now
  const day = 24 * 60 * 60 * 1000
  const hour = 60 * 60 * 1000
  const minute = 60 * 1000
  const relative = remaining >= 2 * day
    ? Math.ceil(remaining / day) + ' days'
    : remaining >= day
      ? '1 day'
      : remaining >= hour
        ? Math.floor(remaining / hour) + 'h ' + Math.ceil((remaining % hour) / minute) + 'm'
        : Math.max(1, Math.ceil(remaining / minute)) + ' min'

  return {
    label: (Date.parse(course.startsAt) > now ? 'Starts' : 'Next class') + ' in ' + relative,
    date: dayLabel(next.startsAt, zone) + ' · ' + shortTime(next.startsAt, zone),
  }
}

function EventRow({
  event, course, zone, now, zoneLabel, showCover = true,
}: {
  event: LiveCalendarEvent
  course: LiveCalendarCourse
  zone: string
  now: number
  zoneLabel: string
  showCover?: boolean
}) {
  const live = Date.parse(event.startsAt) <= now && Date.parse(event.endsAt) > now
  const past = Date.parse(event.endsAt) <= now
  return (
    <Link
      className={'lc-event-row lc-event-row--' + course.palette +
        (past ? ' lc-event-row--past' : '') +
        (!showCover ? ' lc-event-row--no-cover' : '')}
      href={event.href}
    >
      <time className="lc-event-date" dateTime={event.startsAt}>{dayLabel(event.startsAt, zone)}</time>
      {showCover ? (
        <span className="lc-event-cover" aria-hidden="true">
          <img src={course.artwork} alt="" loading="lazy" />
        </span>
      ) : null}
      <span className="lc-event-name">
        <span className="lc-event-course">{course.label}</span>
        <strong>{event.title}</strong>
      </span>
      <span className="lc-event-time-wrap">
        <span className="lc-event-time">{timeRange(event, zone)}</span>
        <small className="lc-event-zone">{zoneLabel}</small>
      </span>
      <span className="lc-event-arrow" aria-hidden="true">↗</span>
      {live ? <span className="lc-event-live">Live now</span> : null}
    </Link>
  )
}

function EarlierClasses({
  entries, zone, now, zoneLabel, showCovers,
}: {
  entries: CalendarEntry[]
  zone: string
  now: number
  zoneLabel: string
  showCovers: boolean
}) {
  if (!entries.length) return null
  return (
    <details className="lc-earlier-details">
      <summary>
        <span className="lc-earlier-closed">Show earlier classes</span>
        <span className="lc-earlier-open">Hide earlier classes</span>
        <span className="lc-earlier-count">({entries.length})</span>
        <span className="lc-earlier-chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="lc-earlier-rows">
        {entries.map(({ event, course }) => (
          <EventRow key={event.id} event={event} course={course} zone={zone}
            now={now} zoneLabel={zoneLabel} showCover={showCovers} />
        ))}
      </div>
    </details>
  )
}

export default function LibraryCalendarExplorer({
  courses, generatedAt,
}: {
  courses: LiveCalendarCourse[]
  generatedAt: string
}) {
  const [view, setView] = useState<View>('list')
  const [activeCourse, setActiveCourse] = useState<string | null>(null)
  const [timePreference, setTimePreference] = useState<TimePreference>('local')
  const [browserZone, setBrowserZone] = useState(ARIZONA_ZONE)
  const [zoneReady, setZoneReady] = useState(false)
  const [now, setNow] = useState(() => Date.parse(generatedAt))
  const [month, setMonth] = useState(() => dayKey(generatedAt, ARIZONA_ZONE).slice(0, 7))
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  useEffect(() => {
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || ARIZONA_ZONE
    const nowMs = Date.now()
    setBrowserZone(localZone)
    setNow(nowMs)
    setMonth(dayKey(new Date(nowMs).toISOString(), localZone).slice(0, 7))
    setZoneReady(true)
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  const zone = timePreference === 'arizona' ? ARIZONA_ZONE : browserZone
  const zoneLabel = timePreference === 'arizona' ? 'Arizona time' : zoneReady ? 'Your local time' : 'Arizona time (checking local time)'
  const shownCourses = activeCourse
    ? courses.filter((course) => course.id === activeCourse)
    : courses
  const allShownEvents = shownCourses.flatMap((course) =>
    course.events.map((event) => ({ event, course })),
  ).sort((a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt))
  const allUpcoming = allShownEvents.filter(({ event }) => Date.parse(event.endsAt) > now)
  const allEarlier = allShownEvents.filter(({ event }) => Date.parse(event.endsAt) <= now).reverse()
  const today = dayKey(new Date(now).toISOString(), zone)
  const monthEvents = allShownEvents.filter(({ event }) => dayKey(event.startsAt, zone).slice(0, 7) === month)
  const firstUpcomingInMonth = monthEvents.find(({ event }) => Date.parse(event.endsAt) > now)
  const highlightedMonthEvent = firstUpcomingInMonth ?? monthEvents[0]
  const displayDay = selectedDay?.slice(0, 7) === month
    ? selectedDay
    : highlightedMonthEvent
      ? dayKey(highlightedMonthEvent.event.startsAt, zone)
      : today.slice(0, 7) === month ? today : month + '-01'
  const dayEvents = monthEvents.filter(({ event }) => dayKey(event.startsAt, zone) === displayDay)
  const monthParts = month.split('-').map(Number)
  const leadingEmptyDays = (new Date(Date.UTC(monthParts[0], monthParts[1] - 1, 1)).getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(monthParts[0], monthParts[1], 0)).getUTCDate()
  const dates: Array<number | null> = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  function goToUsefulMonth(courseId: string | null) {
    const relevant = courseId ? courses.filter((course) => course.id === courseId) : courses
    const next = relevant.flatMap((course) => course.events)
      .filter((event) => Date.parse(event.endsAt) > now)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0]
    const currentMonth = dayKey(new Date(now).toISOString(), zone).slice(0, 7)
    const currentUpcoming = relevant.some((course) => course.events.some((event) =>
      dayKey(event.startsAt, zone).slice(0, 7) === currentMonth && Date.parse(event.endsAt) > now,
    ))
    setMonth(next && !currentUpcoming ? dayKey(next.startsAt, zone).slice(0, 7) : currentMonth)
    setSelectedDay(null)
  }

  function selectCourse(id: string | null) {
    const next = activeCourse === id ? null : id
    setActiveCourse(next)
    if (view === 'calendar') goToUsefulMonth(next)
  }

  function selectView(next: View) {
    setView(next)
    if (next === 'calendar') goToUsefulMonth(activeCourse)
  }

  function selectTimePreference(next: TimePreference) {
    setTimePreference(next)
    setSelectedDay(null)
  }

  return (
    <main className="container page lc-page">
      <div className="lc-intro">
        <div>
          <div className="eyebrow">Schedule</div>
          <h1>Live class calendar</h1>
          <p className="lead">Find every published class date by course, or see them together on a calendar.</p>
        </div>
        <div className="lc-time-controls">
          <span className="lc-control-caption">{timePreference === 'arizona' ? 'Arizona time (UTC−7)' : zoneReady ? 'Your local time' : 'Times will adjust to your location'}</span>
          <div className="lc-segment" role="group" aria-label="Show schedule times in">
            <button type="button" className={timePreference === 'local' ? 'is-selected' : ''} aria-pressed={timePreference === 'local'} onClick={() => selectTimePreference('local')}>My time</button>
            <button type="button" className={timePreference === 'arizona' ? 'is-selected' : ''} aria-pressed={timePreference === 'arizona'} onClick={() => selectTimePreference('arizona')}>Arizona</button>
          </div>
        </div>
      </div>

      <section className="lc-courses" aria-label="Courses with live schedules">
        <div className="lc-section-title">
          <div><h2>Courses on the schedule</h2><p>Every ongoing course stays visible, even when its next class is not the closest.</p></div>
          <button type="button" className={'lc-all-filter' + (!activeCourse ? ' is-selected' : '')} aria-pressed={!activeCourse} onClick={() => selectCourse(null)}>
            All courses <span>{courses.length}</span>
          </button>
        </div>
        <div className="lc-course-grid">
          {courses.map((course) => {
            const state = status(course, now, zone)
            const countdown = countdownForCourse(course, now, zone)
            return (
              <button
                type="button"
                key={course.id}
                aria-pressed={activeCourse === course.id}
                className={'lc-course-tile lc-course-tile--' + course.palette + (activeCourse === course.id ? ' is-selected' : '') + (state.key === 'ongoing' ? ' is-ongoing' : '')}
                onClick={() => selectCourse(course.id)}
              >
                <span className="lc-tile-cover"><img src={course.artwork} alt="" loading="eager" /></span>
                <span className="lc-tile-copy">
                  <span className="lc-tile-label">{course.label}</span>
                  <strong>{course.title}</strong>
                  <span className="lc-tile-next" aria-live="off">{countdown.label}</span>
                  {countdown.date ? <span className="lc-tile-date">{countdown.date}</span> : null}
                </span>
                <span className={'lc-course-status lc-course-status--' + state.key}>{state.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="lc-view-bar">
        <div className="lc-view-context">
          <h2>{view === 'list' ? (activeCourse ? 'Class schedule' : 'Upcoming classes') : 'Monthly calendar'}</h2>
          <p>{activeCourse ? shownCourses[0]?.label : 'All courses in date order'} · {zoneLabel}</p>
        </div>
        <div className="lc-segment lc-view-switch" role="group" aria-label="Calendar display">
          <button type="button" className={view === 'list' ? 'is-selected' : ''} aria-pressed={view === 'list'} onClick={() => selectView('list')}>☷ List</button>
          <button type="button" className={view === 'calendar' ? 'is-selected' : ''} aria-pressed={view === 'calendar'} onClick={() => selectView('calendar')}>▦ Calendar</button>
        </div>
      </div>

      {view === 'list' ? (
        activeCourse === null ? (
          <section className="lc-all-agenda" aria-label="Upcoming classes from all courses">
            {allUpcoming.length ? (
              <div className="lc-event-list">
                {allUpcoming.map(({ event, course }) => (
                  <EventRow key={event.id} event={event} course={course}
                    zone={zone} now={now} zoneLabel={zoneLabel} />
                ))}
              </div>
            ) : (
              <p className="lc-empty-inline">No upcoming classes are currently listed.</p>
            )}
            <EarlierClasses entries={allEarlier} zone={zone} now={now}
              zoneLabel={zoneLabel} showCovers={true} />
          </section>
        ) : (
          <div className="lc-course-lists">
            {shownCourses.map((course) => {
              const state = status(course, now, zone)
              const upcoming = course.events.filter((event) => Date.parse(event.endsAt) > now)
              const previous = course.events
                .filter((event) => Date.parse(event.endsAt) <= now)
                .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
              return (
                <section className={'lc-course-section lc-course-section--' + course.palette}
                  key={course.id} aria-label={course.label + ' schedule'}>
                  <header className="lc-course-section-head">
                    <Link href={course.href} className="lc-section-artwork" aria-label={'Open ' + course.title}>
                      <img src={course.artwork} alt={course.artworkAlt} loading="lazy" />
                    </Link>
                    <div className="lc-section-copy">
                      <div className="lc-section-kicker">
                        <span>{course.label}</span>
                        <span className={'lc-course-status lc-course-status--' + state.key}>{state.label}</span>
                      </div>
                      <h3>{course.title}</h3>
                      <p>{course.cadence}</p>
                      <div className="lc-section-actions">
                        <Link href={course.href}>Course details ↗</Link>
                        {course.calendarHref ? (
                          <a href={course.calendarHref}>Add full schedule to calendar ↗</a>
                        ) : null}
                      </div>
                    </div>
                  </header>
                  {upcoming.length ? (
                    <>
                      <div className="lc-list-heading">
                        <h4>Upcoming classes</h4><span>{upcoming.length} listed</span>
                      </div>
                      <div className="lc-event-list">
                        {upcoming.map((event) => (
                          <EventRow key={event.id} event={event} course={course}
                            zone={zone} now={now} zoneLabel={zoneLabel} showCover={false} />
                        ))}
                      </div>
                    </>
                  ) : <p className="lc-empty-inline">No future classes in this published schedule.</p>}
                  <EarlierClasses entries={previous.map((event) => ({ event, course }))}
                    zone={zone} now={now} zoneLabel={zoneLabel} showCovers={false} />
                  <p className="lc-schedule-note">{course.scheduleNote}</p>
                </section>
              )
            })}
          </div>
        )
      ) : (
        <section className="lc-month-panel" aria-label="Calendar by month">
          <div className="lc-month-toolbar">
            <div>
              <h3>{formatMonth(month)}</h3>
              <p>{monthEvents.length} {monthEvents.length === 1 ? 'class' : 'classes'} on this month’s schedule</p>
            </div>
            <div className="lc-month-actions">
              <button type="button" className="lc-month-today" onClick={() => { setMonth(today.slice(0, 7)); setSelectedDay(today) }}>Today</button>
              <button type="button" aria-label="Previous month" className="lc-month-arrow" onClick={() => { setMonth(changeMonth(month, -1)); setSelectedDay(null) }}>‹</button>
              <button type="button" aria-label="Next month" className="lc-month-arrow" onClick={() => { setMonth(changeMonth(month, 1)); setSelectedDay(null) }}>›</button>
            </div>
          </div>
          <div className="lc-month-weekdays" aria-hidden="true">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="lc-month-grid">
            {dates.map((date, index) => {
              if (!date) return <div className="lc-day lc-day--blank" key={'empty-' + index} aria-hidden="true" />
              const dateKey = month + '-' + String(date).padStart(2, '0')
              const inDay = monthEvents.filter(({ event }) => dayKey(event.startsAt, zone) === dateKey)
              const isSelected = displayDay === dateKey
              return (
                <div className={'lc-day' + (isSelected ? ' is-selected' : '') + (today === dateKey ? ' is-today' : '')} key={dateKey}>
                  <button type="button" className="lc-day-pick" aria-label={fullDayLabel(dateKey) + ', ' + inDay.length + ' classes'} aria-pressed={isSelected} onClick={() => setSelectedDay(dateKey)}>
                    <span>{date}</span>
                    <span className="lc-day-count">{inDay.length ? inDay.length : ''}</span>
                  </button>
                  <div className="lc-day-event-links">
                    {inDay.map(({ event, course }) => (
                      <Link
                        key={event.id}
                        className={'lc-day-event lc-day-event--' + course.palette}
                        href={event.href}
                        aria-label={course.label + ': ' + event.title + ', ' + shortTime(event.startsAt, zone)}
                      >
                        <img src={course.artwork} alt="" loading="lazy" />
                        <span className="lc-day-event-info"><strong>{course.shortLabel} · {event.title}</strong><small>{shortTime(event.startsAt, zone)}</small></span>
                      </Link>
                    ))}
                  </div>
                  <div className="lc-day-dots" aria-hidden="true">
                    {inDay.map(({ event, course }) => <span key={event.id} className={'lc-dot lc-dot--' + course.palette} />)}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="lc-selected-day">
            <div className="lc-selected-heading">
              <div className="eyebrow">Selected day</div>
              <h3>{fullDayLabel(displayDay)}</h3>
            </div>
            {dayEvents.length ? (
              <div className="lc-selected-events">
                {dayEvents.map(({ event, course }) => <EventRow key={event.id} event={event} course={course} zone={zone} now={now} zoneLabel={zoneLabel} />)}
              </div>
            ) : <p className="lc-empty-inline">No published classes on this day. Select another date to explore.</p>}
          </div>
        </section>
      )}
      <p className="lc-page-footnote">Calendar dates come from the published course schedules. Recurring classes without an announced end date continue beyond the dates displayed here.</p>
    </main>
  )
}
