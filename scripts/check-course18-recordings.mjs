import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const load = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const records = JSON.parse(load('content/classics/course-18-recordings.json'))
const schedule = JSON.parse(load('content/classics/course-18-schedule.json'))
const expected = [
  'oQYnS1wLe-k',
  'd164rqeicds',
  'SmiuED2Sjkk',
  'R90dFMwWU3k',
]

assert.equal(records.schemaVersion, 1)
assert.equal(records.course, 18)
assert.equal(records.playlistUrl, 'https://www.youtube.com/playlist?list=PLGskEd2Fm5fk')
assert.deepEqual(records.recordings.map(item => item.classNumber), [1, 2, 3, 4])
assert.deepEqual(records.recordings.map(item => item.videoId), expected)
assert.equal(new Set(records.recordings.map(item => item.videoId)).size, 4)
for (const item of records.recordings) {
  const video = new URL(item.url)
  assert.equal(video.hostname, 'youtu.be')
  assert.equal(video.pathname.slice(1), item.videoId)
  assert.match(item.videoId, /^[a-zA-Z0-9_-]{11}$/)
}
assert.equal(schedule.sessions.length, 5, 'Keep five source teaching blocks for Classes 1–10')
const coursePage = load('components/classics-course-hub.tsx')
const detailPage = load('app/courses/course-18/[classSlug]/page.tsx')
assert.ok(coursePage.includes('course18PlaylistUrl'), 'Course page must link the supplied playlist')
assert.ok(coursePage.includes('course18RecordingFor(item.number)'), 'Course page must show recording availability')
assert.ok(detailPage.includes('course18RecordingFor(item.number)'), 'Class page must resolve by class number')
assert.ok(detailPage.includes('<RecordingPlayer'), 'Class page must embed the class recording')
assert.ok(detailPage.includes("title={recording ? 'Class recording' : 'Recording not added yet'}"), 'Untimed future classes must preserve their recording placeholder')
assert.ok(detailPage.includes('Transcript not added yet'), 'No transcripts were supplied and none should be invented')
console.log('ACI 18 source playlist and Class 1–4 recordings are correctly connected; Classes 5–10 remain scheduled.')
