import assert from 'node:assert/strict'
import { classicsCourseNumber, mergeCourseOfferings } from '../lib/classics-offering-utils.ts'

assert.equal(classicsCourseNumber('classics-course-1'), 1)
assert.equal(classicsCourseNumber('classics-course-17'), 17)
assert.equal(classicsCourseNumber('classics-course-18'), 18)
for (const key of ['classics-course-0','classics-course-19','classics-course-08','course-8','../course-1']) {
  assert.equal(classicsCourseNumber(key), null)
}
const existing = [{slug:'arizona-2026',label:'Arizona 2026'},{slug:'taiwan-2026',label:'Taiwan 2026'}]
const result = mergeCourseOfferings(existing, [
  {slug:'arizona-2026',label:'Arizona 2026 updated'},
  {slug:'kyoto-2027',label:'Kyoto 2027'},
])
assert.deepEqual(result.map(v=>v.slug), ['arizona-2026','taiwan-2026','kyoto-2027'])
assert.equal(result[0].label, 'Arizona 2026 updated')
assert.equal(result[1].label, 'Taiwan 2026')
assert.equal(existing[0].label, 'Arizona 2026')
assert.deepEqual(mergeCourseOfferings(existing, []), existing)
console.log('Existing 18-course offering integration: passed.')
