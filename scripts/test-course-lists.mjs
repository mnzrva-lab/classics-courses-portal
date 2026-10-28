import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { individualCourse18Classes, formatCourse18Date, formatCourse18ClassTime } from '../lib/course18-individual-classes.ts'

const load = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const schedule = JSON.parse(load('content/classics/course-18-schedule.json'))
const classes = individualCourse18Classes(schedule)
assert.equal(schedule.sessions.length, 5, 'The original Course 18 schedule contains five two-class blocks')
assert.equal(classes.length, 10, 'Ten separate Course 18 links are required')
assert.deepEqual(classes.map(item => item.number), Array.from({ length: 10 }, (_, i) => i + 1))
assert.deepEqual(classes.map(item => item.href), Array.from({ length: 10 }, (_, i) => '/courses/course-18/class-' + (i + 1)))
assert.deepEqual(classes.map(item => item.block.startsAt), schedule.sessions.flatMap(s => [s.startsAt, s.startsAt]))
assert.equal(formatCourse18Date(classes[2].block.startsAt), 'Sunday, October 25, 2026')
// The organizer confirmed two individual 90-minute classes, with a 30-minute break.
assert.deepEqual(classes.map(item => item.startsAt), schedule.sessions.flatMap(block => [
  new Date(Date.parse(block.startsAt)).toISOString(), new Date(Date.parse(block.startsAt) + 120 * 60 * 1000).toISOString(),
]))
assert.deepEqual(classes.map(item => item.endsAt), schedule.sessions.flatMap(block => [
  new Date(Date.parse(block.startsAt) + 90 * 60 * 1000).toISOString(),
  new Date(Date.parse(block.endsAt)).toISOString(),
]))
assert.equal(formatCourse18ClassTime(classes[0]), '5:30–7:00 am AZ')
assert.equal(formatCourse18ClassTime(classes[1]), '7:30–9:00 am AZ')
assert.equal(formatCourse18ClassTime(classes[8]), '5:30–7:00 am AZ')
assert.equal(formatCourse18ClassTime(classes[9]), '7:30–9:00 am AZ')
assert.ok(!formatCourse18ClassTime(classes[0]).includes('shared block'))

const course16 = JSON.parse(load('content/classics/archive-sessions/course-16.json')).offerings['archive-2025-2026'].sessions
assert.equal(course16.length, 10)
assert.deepEqual(course16.map(item => item.code), Array.from({ length: 10 }, (_, i) => 'C' + (i + 1)))
assert.ok(course16.every(item => item.videoId && item.url && item.date), 'All ten Course 16 links must have verified source data')

const course8Page = load('app/courses/course-8/taiwan-2026/page.tsx')
assert.ok(!course8Page.includes('Course materials') && !course8Page.includes('id="materials"'),
  'The unfinished Course 8 Reading section should remain hidden')
assert.ok(!course8Page.includes('Source recovered · link being connected'), 'Do not show dead material status pills')

const course16Hub = load('components/classics-course-hub.tsx')
assert.ok(course16Hub.includes('archiveSessionsFor(16,'), 'Course 16 list must read verified archived sessions')
assert.ok(course16Hub.includes('individualCourse18Classes(course18Schedule)'), 'Course 18 must have ten distinct linked classes')
assert.ok(course16Hub.includes('status: formatCourse18ClassTime(item)'), 'Course 18 list must show each class time')
const course18Detail = load('app/courses/course-18/[classSlug]/page.tsx')
assert.ok(course18Detail.includes('formatCourse18ClassTime(item)'), 'Course 18 class pages must show the individual time')
assert.ok(!course18Detail.includes('Individual class timings have not been confirmed'), 'Remove obsolete shared-time warning')
const term7Hub = load('app/living-lam-rim/[termSlug]/page.tsx')
assert.ok(term7Hub.includes('weeklyTermOccurrences(schedule, 0, 10)'), 'Term 7 must start at first Monday')
assert.ok(term7Hub.includes("'/living-lam-rim/term-7/monday-' + session.date"), 'Term 7 date links missing')
assert.ok(term7Hub.includes("code: 'C' + (index + 1)"), 'Term 7 cards should use C1, C2, etc.')
assert.ok(term7Hub.includes("title: 'Class ' + (index + 1)"), 'Term 7 cards should show Class 1, Class 2, etc.')
assert.ok(term7Hub.includes("meta: formatArizonaDate(session.startsAt)"), 'Term 7 class dates must appear below class title')
assert.ok(term7Hub.includes("status: formatArizonaTimeRange(schedule)"), 'Term 7 weekly class time must remain visible')
assert.ok(term7Hub.includes('<h2>Schedule</h2>'), 'Term 7 must have its own schedule header')
assert.ok(term7Hub.includes('<h2>Classes 1–10</h2>'), 'Term 7 must have a separate class-list header')
assert.ok(term7Hub.indexOf('llr-live-term') < term7Hub.indexOf('llr-course-classes'), 'Schedule panel should precede the classes section')
assert.ok(term7Hub.indexOf('llr-course-classes') < term7Hub.indexOf('<LibrarySessionList rows={firstMondays'), 'Classes must be outside the schedule panel')
const term7ClassPage = load('app/living-lam-rim/term-7/[dateSlug]/page.tsx')
assert.ok(term7ClassPage.includes("const classTitle = 'Class ' + classNumber"), 'Term 7 class pages must match list headings')
assert.ok(term7ClassPage.includes("title={classTitle}"), 'Term 7 class page H1 should be Class #')
assert.ok(!term7ClassPage.includes('A class number and its materials have not been assigned yet'), 'Old unnumbered placeholder must be removed')
console.log('Verified C18 individual AZ class times and Term 7 separate schedule/class panels, numbering, links, and headings')
