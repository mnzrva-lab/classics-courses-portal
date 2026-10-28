import { getTerm7Schedule } from '@/lib/term7-content'
import { weeklyTermOccurrences } from '@/lib/weekly-term-schedule'

export const dynamic = 'force-dynamic'

function escapeIcs(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}
function utcIcs(iso: string) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}
function fold(text: string) {
  const parts: string[] = []
  let rest = text
  // ASCII metadata and short Unicode labels; keep individual lines manageable.
  while (rest.length > 72) {
    parts.push(rest.slice(0, 72))
    rest = rest.slice(72)
  }
  parts.push(rest)
  return parts.join('\r\n ')
}

export async function GET(request: Request) {
  const schedule = await getTerm7Schedule()
  const first = weeklyTermOccurrences(schedule, 0, 1)[0]
  if (!first) return new Response('Schedule unavailable', { status: 503 })
  const courseUrl = new URL('/living-lam-rim/term-7', request.url).href

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Classics Courses Portal//Living Lam Rim Term 7//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Living Lam Rim - Term 7',
    'BEGIN:VEVENT',
    'UID:living-lam-rim-term7-20261102@classics-courses-portal',
    'DTSTAMP:' + utcIcs(new Date().toISOString()),
    'DTSTART:' + utcIcs(first.startsAt),
    'DTEND:' + utcIcs(first.endsAt),
    'RRULE:FREQ=WEEKLY;BYDAY=MO' + (schedule.endDate ? ';UNTIL=' + utcIcs(schedule.endDate + 'T23:59:59.000Z') : ''),
    'SUMMARY:' + escapeIcs('Living Lam Rim · Term 7 · ' + schedule.title),
    'DESCRIPTION:' + escapeIcs(
      'Weekly live classes on Mondays from November 2, 2026, 7:00-8:15 am Arizona time. ' +
      'A final class date has not yet been announced. This repeating calendar event has no end date until confirmed.\n' +
      'Course information: ' + courseUrl,
    ),
    'URL:' + courseUrl,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
  return new Response(lines.map(fold).join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="living-lam-rim-term-7.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
