import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function icsDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function foldLine(line: string) {
  const max = 72
  if (line.length <= max) return line
  const parts: string[] = []
  let rest = line
  while (rest.length > max) {
    parts.push(rest.slice(0, max))
    rest = rest.slice(max)
  }
  parts.push(rest)
  return parts.join('\r\n ')
}

function safeFileName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'course-schedule'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseSlug: string; offeringSlug: string }> },
) {
  const { courseSlug, offeringSlug } = await params
  const supabase = await createClient()

  const { data: course } = await supabase
    .from('courses')
    .select('id, canonical_number, title')
    .eq('slug', courseSlug)
    .eq('status', 'published')
    .maybeSingle()

  if (!course) return new Response('Course not found', { status: 404 })

  const { data: offering } = await supabase
    .from('course_offerings')
    .select('id, label')
    .eq('course_id', course.id)
    .eq('slug', offeringSlug)
    .eq('status', 'published')
    .maybeSingle()

  if (!offering) return new Response('Course Offering not found', { status: 404 })

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, code, title, starts_at, ends_at, source_timezone, session_teachers(teachers(full_name))')
    .eq('offering_id', offering.id)
    .eq('status', 'published')
    .not('starts_at', 'is', null)
    .order('sort_order')

  const now = icsDate(new Date().toISOString())!
  const events: string[] = []

  for (const session of sessions ?? []) {
    if (!session.starts_at) continue
    const startsAt = icsDate(session.starts_at)
    if (!startsAt) continue
    const endsAt = session.ends_at ? icsDate(session.ends_at) : null
    const teachers = (session.session_teachers ?? [])
      .map((item: any) => item.teachers?.full_name)
      .filter(Boolean)
    const courseName = course.canonical_number ? `CLASSIC ACI ${course.canonical_number}` : course.title
    const summary = `${courseName} · ${session.title}${teachers.length ? ` · ${teachers.join(', ')}` : ''}`
    const description = [
      course.title,
      offering.label,
      teachers.length ? `Teacher: ${teachers.join(', ')}` : null,
      session.source_timezone ? `Source timezone: ${session.source_timezone}` : null,
      'Open the course portal for the recording, class materials, and current live-session access.',
    ].filter(Boolean).join('\n')

    events.push([
      'BEGIN:VEVENT',
      `UID:${escapeIcs(`${session.id}@classics-courses-portal`)}`,
      `DTSTAMP:${now}`,
      `DTSTART:${startsAt}`,
      endsAt ? `DTEND:${endsAt}` : null,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT',
    ].filter(Boolean).map((line) => foldLine(String(line))).join('\r\n'))
  }

  const calendarName = `${course.canonical_number ? `CLASSIC ACI ${course.canonical_number}` : course.title} · ${offering.label}`
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Classics Courses with Timothy Lowenhaupt//Course Offering//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
    ...events,
    'END:VCALENDAR',
    '',
  ].map((line) => line.startsWith('BEGIN:VEVENT') ? line : foldLine(line)).join('\r\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFileName(calendarName)}.ics"`,
      'Cache-Control': 'no-store',
    },
  })
}
