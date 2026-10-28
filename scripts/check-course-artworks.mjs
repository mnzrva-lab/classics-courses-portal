import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url))
const catalog = JSON.parse(read('content/classics/catalog.json').toString('utf8'))
const homepage = read('app/page.tsx').toString('utf8')
const eyeProgram = read('content/eye-of-courage/program.ts').toString('utf8')

const covers = [
  { course: 8, path: '/images/classics/course-8/taiwan-2026.webp', sha256: '92bb615a3be4514c8a6e1a12ab35c411c260130e48303a0042eef6d6bda4726c' },
  { course: 16, path: '/images/classics/course-16/arizona-2026.webp', sha256: 'fc0cb7fa3ec7048c3b7ed878d3df6803e217cb90d4082694d2488275766871b2' },
  { course: 17, path: '/images/classics/course-17/arizona-2026.webp', sha256: '1283a87a0c79ca2c167f1aafc907256eaa307696bcfe44b27d6d2dc2b1253ab1' },
  { course: 18, path: '/images/classics/course-18/arizona-2026.webp', sha256: 'f6816f7fa2f2b3af19d07072b7cb3a3afc54aac319950df22f696a710fe22a94' },
  { course: 'eye-of-courage', path: '/images/other-programs/eye-of-courage/2026.webp', sha256: 'e6e9c81c52cb92379bb3a79965bfbb0e12dade00375b365a6d6eeb5b900c66b9' },
]
for (const cover of covers) {
  const bytes = read('public' + cover.path)
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', cover.path + ' WebP RIFF header')
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', cover.path + ' WebP signature')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), cover.sha256, cover.path + ' original bytes')
  if (typeof cover.course === 'number') {
    const entry = catalog.find((course) => course.canonicalNumber === cover.course)
    assert.equal(entry?.artwork, cover.path, 'Missing Classics Course ' + cover.course + ' cover mapping')
    assert.ok(entry?.artworkAlt, 'Missing Classics Course ' + cover.course + ' alt text')
  } else {
    assert.ok(eyeProgram.includes("coverPath: '" + cover.path + "'"), 'Missing Eye of Courage cover mapping')
  }
}
assert.ok(homepage.includes("artwork: '/images/other-programs/eye-of-courage/2026.webp'"),
  'Homepage local fallback must use the new Eye of Courage cover')
assert.ok(homepage.includes("artwork: course.artwork ?? null"),
  'Upcoming Courses must continue to use catalog artwork, including Course 18')
for (const course of [8, 16, 17]) {
  assert.ok(homepage.includes("artwork: '" + covers.find((item) => item.course === course).path + "'"),
    'Latest Courses fallback missing Course ' + course + ' cover')
}
console.log('Verified 5 original WebP covers, exact bytes, source mapping, and homepage fallbacks')
