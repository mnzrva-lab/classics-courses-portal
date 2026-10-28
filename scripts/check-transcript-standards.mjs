import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const read = file => readFileSync(file, 'utf8')
const mustContain = (file, expected) =>
  assert.ok(read(file).includes(expected), `${file} must contain ${expected}`)

// The approved notice is a literal contract. Editors must approve any change.
const notice = read('components/transcript-notice.tsx')
assert.ok(notice.includes('About this transcript'))
assert.ok(notice.includes('This transcript was created by a student with AI and should be used for reference only. Please check it against the video and audio for accuracy of content.'))

// All active source-backed class pages render one and the same approved notice.
const pages = [
  'app/archive/classics/[courseSlug]/[offeringSlug]/[sessionSlug]/page.tsx',
  'app/courses/course-8/taiwan-2026/[sessionSlug]/page.tsx',
  'app/living-lam-rim/[termSlug]/[sessionSlug]/page.tsx',
  'app/perfection-of-wisdom/[groupSlug]/[sessionSlug]/page.tsx',
  'components/eye-of-courage-class-page.tsx',
]
for (const page of pages) {
  mustContain(page, "import TranscriptNotice from '@/components/transcript-notice'")
  mustContain(page, '<TranscriptNotice />')
  assert.ok(!read(page).includes('This transcript was created by a student with AI and should be used for reference only.'), `${page}: use the shared notice instead of duplicating its text`)
}

const shell = read('components/transcript-reader-shell.tsx')
const toolbar = read('components/transcript-reader-toolbar.tsx')
const library = read('components/library-transcript-reader.tsx')
const aci17 = read('components/aci17-preview-reader.tsx')
const archive = read('components/timed-archive-transcript.tsx')

for (const source of [shell, aci17, archive]) {
  assert.ok(source.includes('<TranscriptReaderToolbar'), 'all timed and source-based readers use shared toolbar')
}
assert.ok(shell.includes('<TranscriptControls chapters={chapters} />'))
assert.ok(library.includes('<TranscriptReaderShell'))
assert.ok(library.includes('<CopyReference'))
assert.ok(library.includes('<TranscriptCiteActivation'))
assert.ok(library.includes('<TranscriptSearchHighlights'))
assert.ok(aci17.includes('<CopyReference'))
assert.ok(archive.includes('<CopyReference'))
assert.ok(toolbar.includes("hasTimes ? ("))
assert.ok(toolbar.includes('Show paragraph times'))
assert.ok(toolbar.includes('Hide paragraph times'))
assert.ok(toolbar.includes('aria-pressed'))
assert.ok(shell.includes("tdl-transcript-text-size"))
assert.ok(shell.includes("tdl-transcript-show-paragraph-times"))
mustContain('app/layout.tsx', "import './transcript-reader-standard.css'")
mustContain('app/transcript-reader-standard.css', '.unified-transcript-reader.show-paragraph-times')
mustContain('app/transcript-reader-standard.css', 'box-shadow: none !important')
mustContain('components/transcript-sync.tsx', "'#transcript [data-transcript-paragraph]'")
const syncNavigation = read('components/transcript-sync.tsx')
assert.ok(syncNavigation.includes('usePathname()'), 'sync state resets between class routes')
assert.ok(syncNavigation.includes("if (!inTranscript) return null"), 'navigation appears only while reading')
assert.ok(syncNavigation.includes('Follow off') && syncNavigation.includes('Follow on'), 'Follow is reversible')
assert.ok(syncNavigation.includes("if (id === 'recording')"), 'jumping to video disables Follow')
assert.ok(syncNavigation.includes('const canFollow = available && pointsRef.current.length > 0'), 'untimed transcripts have no Follow')
assert.ok(read('app/layout.tsx').includes('<TranscriptSync/>'), 'one controller is mounted globally')
assert.ok(!read('components/eye-of-courage-class-page.tsx').includes('TranscriptQuickNav'), 'no duplicate Eye nav')
for (const reader of [aci17, archive]) {
  assert.ok(!reader.includes('timed-transcript-jump-back') && !reader.includes('showJumpBack'), 'no duplicate timed nav')
}
assert.ok(!read('app/eye-of-courage-refinement.css').includes('.transcript-quick-nav'), 'old Eye nav CSS removed')
assert.ok(!read('app/timed-transcript.css').includes('.timed-transcript-jump-back'), 'old timed nav CSS removed')
assert.ok(read('app/transcript-reader-standard.css').includes('.transcript-sync-floating'), 'one navigation stylesheet')

// The shared toolbar is the default whenever a class receives timestamped
// paragraphs. Do not add a route-specific widget when importing timecodes.
const recording = read('components/recording-player.tsx')
assert.ok(recording.includes("new CustomEvent('recording-time'"), 'YouTube player must publish playback time')
assert.ok(recording.includes("window.addEventListener('recording-seek'"), 'timestamp controls must seek YouTube')
assert.ok(syncNavigation.includes("attributeFilter: ['hidden']"), 'toolbar must follow study tab visibility')
assert.ok(syncNavigation.includes('function toggleFollow()'), 'Follow must work immediately after activation')
for (const [name, source] of [['shared source reader', library], ['ACI 17 reader', aci17], ['archive timed reader', archive]]) {
  assert.ok(source.includes('data-transcript-paragraph'), name + ' must publish paragraph anchors to the shared controller')
  assert.ok(source.includes('data-transcript-seek'), name + ' must publish timestamp seeking for new timecoded content')
  assert.ok(!source.includes('<TranscriptSync') && !source.includes('<TranscriptQuickNav'), name + ' must not mount a second controller')
}
for (const page of pages) {
  assert.ok(!read(page).includes('<TranscriptSync') && !read(page).includes('<TranscriptQuickNav'), page + ' must inherit global class controls')
}
assert.ok(!read('app/timed-transcript.css').includes('.transcript-sync-floating'), 'legacy mobile CSS cannot override the shared toolbar')

// ACI 17 has exactly ten class URLs, with transcript reader wired from one route.
const archiveCatalog = JSON.parse(read('content/classics/archive-sessions/course-17.json'))
const sessions = archiveCatalog.offerings?.['current-2026']?.sessions
assert.ok(Array.isArray(sessions) && sessions.length === 10, 'ACI 17 must have ten catalog entries')
assert.deepEqual(sessions.map(s => s.code), Array.from({ length: 10 }, (_, i) => `C${i + 1}`))
mustContain(pages[0], '<ACI17PreviewReader')

console.log('Transcript standards passed: approved notice, shared toolbar and search/chapter/citation controls, optional timing, and ACI 17 class catalog.')
