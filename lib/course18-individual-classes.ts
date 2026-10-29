/**
 * ACI 18 has five two-class teaching dates. The organizer confirmed on
 * October 28, 2026 that the first class is 5:30–7:00 am AZ and the second
 * is 7:30–9:00 am AZ. The original 5:30–9:00 am teaching block is retained
 * for the shared live countdown and calendar.
 */
export type Course18TeachingBlock = {
  id: string
  label: string
  startsAt: string
  endsAt: string
  rebroadcastAt?: string
}
export type Course18BlockSchedule = { sessions: Course18TeachingBlock[] }

export type Course18ClassEntry = {
  number: number
  title: string
  href: string
  block: Course18TeachingBlock
  startsAt: string
  endsAt: string
}

const CLASS_MINUTES = 90
const BREAK_MINUTES = 30
const MS_PER_MINUTE = 60 * 1000

/** One verified class pair produces two individual dated/time-specific entries. */
export function individualCourse18Classes(schedule: Course18BlockSchedule): Course18ClassEntry[] {
  const entries: Course18ClassEntry[] = []
  const seen = new Set<number>()
  for (const block of schedule.sessions) {
    const pair = /^Classes\s+(\d+)\s*(?:&|and|–|-)\s*(\d+)$/i.exec(block.label.trim())
    if (!pair) continue
    const first = Number(pair[1])
    const second = Number(pair[2])
    if (first < 1 || second > 10 || second !== first + 1) continue

    const blockStart = Date.parse(block.startsAt)
    const blockEnd = Date.parse(block.endsAt)
    if (!Number.isFinite(blockStart) || !Number.isFinite(blockEnd) ||
        blockEnd - blockStart !== (CLASS_MINUTES * 2 + BREAK_MINUTES) * MS_PER_MINUTE) continue

    for (const number of [first, second]) {
      if (seen.has(number)) continue
      seen.add(number)
      const minutesFromStart = number === first ? 0 : CLASS_MINUTES + BREAK_MINUTES
      const startsAt = new Date(blockStart + minutesFromStart * MS_PER_MINUTE).toISOString()
      const endsAt = new Date(blockStart + (minutesFromStart + CLASS_MINUTES) * MS_PER_MINUTE).toISOString()
      entries.push({
        number,
        title: 'Class ' + number,
        href: '/courses/course-18/class-' + number,
        block,
        startsAt,
        endsAt,
      })
    }
  }
  return entries.sort((a, b) => a.number - b.number)
}

export function formatCourse18Date(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix', weekday: 'long',
    month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

/** Display the organizer-confirmed class time, not the whole paired teaching block. */
export function formatCourse18ClassTime(entry: Pick<Course18ClassEntry, 'startsAt' | 'endsAt'>) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  function localTime(iso: string) {
    const parts = formatter.formatToParts(new Date(iso))
    const part = (kind: string) => parts.find(item => item.type === kind)?.value ?? ''
    return { clock: part('hour') + ':' + part('minute'), meridiem: part('dayPeriod').toLowerCase() }
  }
  const start = localTime(entry.startsAt)
  const end = localTime(entry.endsAt)
  return start.clock + (start.meridiem !== end.meridiem ? ' ' + start.meridiem : '') +
    '–' + end.clock + ' ' + end.meridiem + ' AZ'
}
