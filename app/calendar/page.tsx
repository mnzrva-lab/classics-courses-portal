import Link from 'next/link'
import { getCourse18Schedule } from '@/lib/course18-content'
import { getTerm7Schedule } from '@/lib/term7-content'
import { weeklyTermOccurrences, formatArizonaDate, formatArizonaTimeRange, formatTermStartDate } from '@/lib/weekly-term-schedule'

export const dynamic = 'force-dynamic'

type CalendarItem = {
  id: string
  title: string
  program: string
  startsAt: string
  endsAt: string
  href: string
  repeats: boolean
}

function azDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

function azTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso))
}

export default async function CalendarPage() {
  const [term7, course18] = await Promise.all([getTerm7Schedule(), getCourse18Schedule()])
  const now = Date.now()
  const recurring: CalendarItem[] = weeklyTermOccurrences(term7, now, 12).map((session) => ({
    id: session.id,
    title: term7.title,
    program: 'Living Lam Rim · Term 7',
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    href: '/living-lam-rim/term-7',
    repeats: true,
  }))
  const course18Events: CalendarItem[] = course18.sessions
    .filter((session) => Date.parse(session.endsAt) > now)
    .map((session) => ({
      id: session.id,
      title: session.label,
      program: 'Classics Course 18 · The Great Ideas of Buddhism, Part III',
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      href: '/courses/course-18',
      repeats: false,
    }))

  const events = [...recurring, ...course18Events]
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, 16)

  return (
    <main className="container page library-calendar-page">
      <div className="eyebrow">Teaching library</div>
      <h1>Live class calendar</h1>
      <p className="lead">Upcoming live classes and weekly teaching sessions, shown in Arizona time.</p>

      <section className="library-calendar-feature" aria-label="Living Lam Rim Term 7 weekly schedule">
        <div className="eyebrow">Starts {formatArizonaDate(term7.startDate + 'T14:00:00Z')}</div>
        <h2>Living Lam Rim · Term 7</h2>
        <h3>{term7.title}</h3>
        <p>Every Monday · {formatArizonaTimeRange(term7)} (UTC−7)</p>
        <p className="meta">{term7.endDate ? `Weekly Mondays through ${formatTermStartDate(term7.endDate)}.` : 'Weekly classes continue on Mondays. The final class date has not been announced.'}</p>
        <div className="actions">
          <Link className="button sage" href="/living-lam-rim/term-7">View course</Link>
          <a className="button" href="/living-lam-rim/term-7/calendar">＋ Add recurring classes to calendar</a>
        </div>
      </section>

      <section className="section compact-section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Upcoming</div>
            <h2>Live sessions</h2>
            <p>Showing the next published classes and the next Mondays in the weekly series.</p>
          </div>
        </div>
        <div className="library-calendar-agenda">
          {events.map((event) => (
            <Link className="library-calendar-row" href={event.href} key={event.id}>
              <time dateTime={event.startsAt} className="library-calendar-row-date">{azDate(event.startsAt)}</time>
              <div className="library-calendar-row-copy">
                <small>{event.program}</small>
                <strong>{event.title}</strong>
                {event.repeats ? <span>Weekly Mondays</span> : null}
              </div>
              <span className="library-calendar-row-time">{azTime(event.startsAt)}–{azTime(event.endsAt)} AZ</span>
              <span aria-hidden="true" className="library-calendar-row-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
