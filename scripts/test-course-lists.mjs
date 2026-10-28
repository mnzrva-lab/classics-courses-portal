import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { individualCourse18Classes, formatCourse18Date, formatCourse18BlockTime } from '../lib/course18-individual-classes.ts'

const load = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const schedule = JSON.parse(load('content/classics/course-18-schedule.json'))
const classes = individualCourse18Classes(schedule)
assert.equal(schedule.sessions.length, 5, 'The original Course 18 schedule contains five two-class blocks')
assert.equal(classes.length, 10, 'Ten separate Course 18 links are required')
assert.deepEqual(classes.map(item => item.number), Array.from({ length: 10 }, (_, i) => i + 1))
assert.deepEqual(classes.map(item => item.href), Array.from({ length: 10 }, (_, i) => '/courses/course-18/class-' + (i + 1)))
assert.deepEqual(classes.map(item => item.block.startsAt), schedule.sessions.flatMap(s => [s.startsAt, s.startsAt]))
assert.equal(formatCourse18Date(classes[2].block.startsAt), 'Sunday, October 25, 2026')
assert.ok(formatCourse18BlockTime(classes[0].block).includes('shared block'), 'Never imply an individual class start time')

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
const term7Hub = load('app/living-lam-rim/[termSlug]/page.tsx')
assert.ok(term7Hub.includes('weeklyTermOccurrences(schedule, 0, 10)'), 'Term 7 must start at first Monday')
assert.ok(term7Hub.includes("'/living-lam-rim/term-7/monday-' + session.date"), 'Term 7 date links missing')
console.log('Course 8 Reading hidden; Course 16 ten recordings; Course 18 ten dates/links; Term 7 date links verified')
