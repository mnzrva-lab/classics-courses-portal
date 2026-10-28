import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isWeeklyTerm7Schedule, weeklyTermOccurrences,
  formatArizonaTimeRange, formatTermStartDate,
} from '../lib/weekly-term-schedule.ts'

const data = JSON.parse(readFileSync(new URL('../content/living-lam-rim/term-7-schedule.json', import.meta.url), 'utf8'))
assert.ok(isWeeklyTerm7Schedule(data), 'Term 7 schedule should validate')
assert.equal(data.title, 'Open the Gift of Liberation')
assert.equal(new Date(data.startDate + 'T12:00:00Z').getUTCDay(), 1, 'Start date is a Monday')
assert.equal(formatTermStartDate(data.startDate), 'Nov 2, 2026')
assert.equal(formatArizonaTimeRange(data), '7:00am–8:15am AZ')
const coming = weeklyTermOccurrences(data, Date.parse('2026-10-28T14:00:00Z'), 4)
assert.deepEqual(coming.map((event) => event.date),
  ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'])
assert.equal(coming[0].startsAt, '2026-11-02T14:00:00.000Z')
assert.equal(coming[0].endsAt, '2026-11-02T15:15:00.000Z')
assert.equal(weeklyTermOccurrences(data, Date.parse('2026-11-02T14:30:00Z'), 1)[0].date, '2026-11-02')
assert.equal(weeklyTermOccurrences(data, Date.parse('2026-11-02T15:16:00Z'), 1)[0].date, '2026-11-09')
const firstTen = weeklyTermOccurrences(data, 0, 10)
assert.deepEqual(firstTen.map((event) => event.date), [
  '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30',
  '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28', '2027-01-04',
])
assert.equal(new Set(firstTen.map(event => event.date)).size, 10)
assert.ok(firstTen.every(event => event.startsAt.endsWith('14:00:00.000Z')))
const spring = weeklyTermOccurrences(data, Date.parse('2027-03-01T16:00:00Z'), 1)[0]
assert.equal(spring.startsAt, '2027-03-08T14:00:00.000Z', 'Phoenix must not shift for DST')
const finite = { ...data, endDate: '2026-11-16' }
assert.equal(weeklyTermOccurrences(finite, Date.parse('2026-10-28T14:00:00Z'), 9).length, 3)
assert.ok(!isWeeklyTerm7Schedule({ ...data, weekday: 'TU' }))
assert.ok(!isWeeklyTerm7Schedule({ ...data, sourceTimezone: 'America/New_York' }))
console.log('Term 7 Monday recurrence and Arizona timezone tests passed')
