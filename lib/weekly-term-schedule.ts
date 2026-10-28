/** Living Lam Rim live sessions use Phoenix time (UTC-7 year-round). */
export type WeeklyTermSchedule = {
  schemaVersion: 1
  program: 'living-lam-rim'
  term: 7
  title: string
  startDate: string
  weekday: 'MO'
  startTime: string
  endTime: string
  sourceTimezone: 'America/Phoenix'
  sourceLabel: string
  endDate: string | null
}

export type WeeklyTermOccurrence = {
  id: string
  label: string
  date: string
  startsAt: string
  endsAt: string
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const PHOENIX_UTC_OFFSET = '-07:00'
const isIsoDay = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + 'T12:00:00Z')) &&
  new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value

const isTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

export function isWeeklyTerm7Schedule(value: unknown): value is WeeklyTermSchedule {
  if (!value || typeof value !== 'object') return false
  const s = value as Partial<WeeklyTermSchedule>
  if (s.schemaVersion !== 1 || s.program !== 'living-lam-rim' || s.term !== 7) return false
  if (typeof s.title !== 'string' || !s.title.trim() || s.title.length > 120) return false
  if (s.weekday !== 'MO' || s.sourceTimezone !== 'America/Phoenix') return false
  if (typeof s.sourceLabel !== 'string' || s.sourceLabel.length > 80) return false
  if (!isIsoDay(s.startDate) || !isTime(s.startTime) || !isTime(s.endTime)) return false
  if (s.endTime <= s.startTime) return false
  if (new Date(s.startDate + 'T12:00:00Z').getUTCDay() !== 1) return false
  if (s.endDate !== null && s.endDate !== undefined && (!isIsoDay(s.endDate) || s.endDate < s.startDate)) return false
  return true
}

/** A weekly series, not a guessed finite set of individually announced class dates. */
export function weeklyTermOccurrences(schedule: WeeklyTermSchedule, fromMs: number, count: number): WeeklyTermOccurrence[] {
  const firstStart = Date.parse(schedule.startDate + 'T' + schedule.startTime + ':00' + PHOENIX_UTC_OFFSET)
  const firstEnd = Date.parse(schedule.startDate + 'T' + schedule.endTime + ':00' + PHOENIX_UTC_OFFSET)
  const duration = firstEnd - firstStart
  if (!Number.isFinite(firstStart) || duration <= 0 || count <= 0) return []

  // Keep the currently running event visible until it finishes.
  let index = Math.max(0, Math.floor((fromMs - firstStart) / WEEK_MS))
  const result: WeeklyTermOccurrence[] = []
  const limit = Math.min(40, Math.floor(count))
  while (result.length < limit) {
    const begins = firstStart + index * WEEK_MS
    const ends = begins + duration
    const date = new Date(begins).toISOString().slice(0, 10)
    if (schedule.endDate && date > schedule.endDate) break
    if (ends > fromMs) {
      result.push({
        id: 'living-lam-rim-term-7-' + date,
        label: 'Term 7 · ' + schedule.title,
        date,
        startsAt: new Date(begins).toISOString(),
        endsAt: new Date(ends).toISOString(),
      })
    }
    index += 1
  }
  return result
}

export function formatArizonaDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatArizonaTimeRange(schedule: WeeklyTermSchedule) {
  const format = (value: string) => {
    const [hour, minute] = value.split(':').map(Number)
    const suffix = hour >= 12 ? 'pm' : 'am'
    const h = hour % 12 || 12
    return h + (minute ? ':' + String(minute).padStart(2, '0') : ':00') + suffix
  }
  return format(schedule.startTime) + '–' + format(schedule.endTime) + ' AZ'
}
