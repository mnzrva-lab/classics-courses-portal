import LibraryCalendarExplorer, { type LiveCalendarCourse } from '@/components/library-calendar-explorer'
import { getCourse18Schedule } from '@/lib/course18-content'
import { getTerm7Schedule } from '@/lib/term7-content'
import { individualCourse18Classes } from '@/lib/course18-individual-classes'
import { weeklyTermOccurrences } from '@/lib/weekly-term-schedule'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const [term7, course18] = await Promise.all([getTerm7Schedule(), getCourse18Schedule()])
  const now = Date.now()
  const course18Classes = individualCourse18Classes(course18)
  const firstCourse18 = course18Classes[0]
  const lastCourse18 = course18Classes[course18Classes.length - 1]

  // Keep past Mondays visible under "Earlier classes" while showing 16 future weeks.
  // Use the verified recurrence utility in batches (it deliberately caps at 40 per call).
  // These are derived dates, never a claim of an announced final class count.
  const firstTerm7Start = Date.parse(term7.startDate + 'T' + term7.startTime + ':00-07:00')
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const term7Horizon = Math.min(160, Math.max(16, Math.ceil((now - firstTerm7Start) / weekMs) + 16))
  const term7Dates = Array.from({ length: Math.ceil(term7Horizon / 40) }, (_, batch) =>
    weeklyTermOccurrences(
      term7, firstTerm7Start + batch * 40 * weekMs - 1,
      Math.min(40, term7Horizon - batch * 40),
    ),
  ).flat()

  const courses: LiveCalendarCourse[] = [
    {
      id: 'course18',
      label: 'Classics Course 18',
      shortLabel: 'Classics 18',
      title: 'The Great Ideas of Buddhism, Part III',
      artwork: '/images/classics/course-18/arizona-2026.webp',
      artworkAlt: 'Moon reflected in a dark cup of tea',
      href: '/courses/course-18',
      startsAt: firstCourse18?.startsAt ?? course18.sessions[0].startsAt,
      endsAt: lastCourse18?.endsAt ?? course18.sessions[course18.sessions.length - 1].endsAt,
      cadence: 'Two classes per day · 5:30–9:00 am Arizona time',
      scheduleNote: '10 classes across five published teaching dates.',
      palette: 'classics',
      events: course18Classes.map((entry) => ({
        id: 'c18-class-' + entry.number,
        title: entry.title,
        number: entry.number,
        href: entry.href,
        startsAt: entry.startsAt,
        endsAt: entry.endsAt,
      })),
    },
    {
      id: 'term7',
      label: 'Living Lam Rim · Term 7',
      shortLabel: 'Lam Rim 7',
      title: term7.title,
      artwork: '/images/living-lam-rim/term-7/BG.webp',
      artworkAlt: 'Living Lam Rim Term 7 original teaching cover',
      href: '/living-lam-rim/term-7',
      calendarHref: '/living-lam-rim/term-7/calendar',
      startsAt: new Date(firstTerm7Start).toISOString(),
      endsAt: term7.endDate ? new Date(term7.endDate + 'T23:59:59-07:00').toISOString() : null,
      cadence: 'Every Monday · 7:00–8:15 am Arizona time',
      scheduleNote: term7.endDate
        ? 'Published weekly dates through the announced end date. This list shows the next scheduled Mondays.'
        : 'Recurring series. The final class date has not been announced. Dates shown are a rolling schedule, not the full length of the course.',
      palette: 'lamrim',
      events: term7Dates.map((entry) => {
        const days = Math.round((Date.parse(entry.date + 'T12:00:00Z') - Date.parse(term7.startDate + 'T12:00:00Z')) / (7 * 86400000))
        const number = days + 1
        return {
          id: entry.id,
          title: 'Class ' + number,
          number,
          href: '/living-lam-rim/term-7/monday-' + entry.date,
          startsAt: entry.startsAt,
          endsAt: entry.endsAt,
        }
      }),
    },
  ]

  return <LibraryCalendarExplorer courses={courses} generatedAt={new Date(now).toISOString()} />
}
