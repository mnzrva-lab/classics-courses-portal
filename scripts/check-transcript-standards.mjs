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

// ACI 17 has exactly ten class URLs, with transcript reader wired from one route.
const archiveCatalog = JSON.parse(read('content/classics/archive-sessions/course-17.json'))
const sessions = archiveCatalog.offerings?.['current-2026']?.sessions
assert.ok(Array.isArray(sessions) && sessions.length === 10, 'ACI 17 must have ten catalog entries')
assert.deepEqual(sessions.map(s => s.code), Array.from({ length: 10 }, (_, i) => `C${i + 1}`))
mustContain(pages[0], '<ACI17PreviewReader')

console.log('Transcript standards passed: approved notice, shared toolbar and search/chapter/citation controls, optional timing, and ACI 17 class catalog.')
