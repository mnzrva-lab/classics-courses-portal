import assert from 'node:assert/strict'
import {
  isManagedLibraryIndex, isManagedLibraryManifest, isManagedTranscript,
  isPublishedSlug, isApprovedExternalLink,
} from '../lib/managed-library-schema.ts'

const copy = value => JSON.parse(JSON.stringify(value))
const index = {
  schemaVersion: 1, entries: [
    { programSlug: 'classics-course-17', offeringSlug: 'arizona-2026', source: 'existing-aci17' },
    { programSlug: 'example-program', offeringSlug: 'test-offering', source: 'managed-v1' },
  ],
}
assert.ok(isManagedLibraryIndex(index))
const duplicated = copy(index)
duplicated.entries.push(copy(duplicated.entries[1]))
assert.equal(isManagedLibraryIndex(duplicated), false, 'Duplicate identities are rejected')
assert.equal(isManagedLibraryIndex({ schemaVersion: 1, entries: [] }), false)
assert.equal(isManagedLibraryIndex({
  schemaVersion: 1, entries: [{ programSlug: 'bad/../path', offeringSlug: 'test', source: 'managed-v1' }],
}), false)
assert.equal(isManagedLibraryIndex({
  schemaVersion: 1, entries: [{ programSlug: 'different', offeringSlug: 'arizona-2026', source: 'existing-aci17' }],
}), false)
assert.equal(isPublishedSlug('class-1'), true)
assert.equal(isPublishedSlug('../private'), false)
assert.equal(isPublishedSlug('Some Class'), false)
assert.equal(isApprovedExternalLink('https://example.org/approved-reading.pdf'), true)
assert.equal(isApprovedExternalLink('javascript:alert(1)'), false)
assert.equal(isApprovedExternalLink('http://example.org/reading'), false)
assert.equal(isApprovedExternalLink('https://user:secret@example.org/'), false)

const manifest = {
  schemaVersion: 1,
  programSlug: 'example-program',
  offeringSlug: 'test-offering',
  programTitle: 'Example Program (test fixture)',
  offeringLabel: 'Test Offering',
  kind: 'Teaching Series',
  description: 'Synthetic metadata used only by automated tests.',
  sessions: [
    {
      slug: 'class-1', code: 'C1', title: 'Test Class 1',
      recordingUrl: 'https://www.youtube.com/watch?v=JGKtCO5G_kg',
      transcript: true, studyNotes: true,
      materials: [{ label: 'Test reading', url: 'https://example.org/reading' }],
    },
    { slug: 'class-2', code: 'C2', title: 'Test Class 2 (not yet recorded)' },
  ],
}
assert.ok(isManagedLibraryManifest(manifest, 'example-program', 'test-offering'))
assert.equal(isManagedLibraryManifest(manifest, 'wrong-program', 'test-offering'), false)
assert.equal(isManagedLibraryManifest({ ...manifest, sessions: [] }, 'example-program', 'test-offering'), false)
assert.equal(isManagedLibraryManifest({
  ...manifest, sessions: [manifest.sessions[0], manifest.sessions[0]],
}, 'example-program', 'test-offering'), false)
assert.equal(isManagedLibraryManifest({
  ...manifest, sessions: [{ ...manifest.sessions[0], recordingUrl: 'file:///etc/passwd' }],
}, 'example-program', 'test-offering'), false)
assert.equal(isManagedLibraryManifest({
  ...manifest, sessions: [{ ...manifest.sessions[0], materials: [
    { label: 'Injected link', url: 'javascript:alert(1)' },
  ] }],
}, 'example-program', 'test-offering'), false)
assert.equal(isManagedLibraryManifest({
  ...manifest, artwork: '/private-image.webp',
}, 'example-program', 'test-offering'), false)

const untimed = {
  schemaVersion: 1,
  sessionId: 'class-2',
  timingStatus: 'unverified',
  chapters: [{
    id: 'chapter-1', title: 'Test introduction', startSeconds: null,
    paragraphs: [
      { id: 'p-001', speaker: 'Test Speaker', text: 'Test passage.', startSeconds: null },
      { id: 'p-002', speaker: '', text: 'More test passage.', startSeconds: null },
    ],
  }],
}
assert.ok(isManagedTranscript(untimed, manifest.sessions[1]))
assert.equal(isManagedTranscript(untimed, manifest.sessions[0]), false, 'Transcript must belong to the correct class')
const badUntimed = copy(untimed)
badUntimed.chapters[0].paragraphs[0].startSeconds = 3
assert.equal(isManagedTranscript(badUntimed, manifest.sessions[1]), false, 'No invented timestamp for unverified source')
const badDup = copy(untimed)
badDup.chapters[0].paragraphs.push(copy(badDup.chapters[0].paragraphs[0]))
assert.equal(isManagedTranscript(badDup, manifest.sessions[1]), false, 'No duplicate paragraph anchors')

const timed = {
  schemaVersion: 1, sessionId: 'class-1', youtubeVideoId: 'JGKtCO5G_kg',
  timingStatus: 'youtube-caption-aligned',
  chapters: [{
    id: 'chapter-1', title: 'Test chapter', startSeconds: 12,
    paragraphs: [
      { id: 'p-001', speaker: 'Test Speaker', text: 'Beginning.', startSeconds: 12,
        timingSource: 'youtube-caption', youtubeCueLine: 8 },
      { id: 'p-002', speaker: '', text: 'Estimated passage.', startSeconds: 34,
        timingSource: 'estimated' },
    ],
  }],
}
assert.ok(isManagedTranscript(timed, manifest.sessions[0]))
const mismatch = copy(timed);mismatch.youtubeVideoId='d164rqeicds'
assert.equal(isManagedTranscript(mismatch, manifest.sessions[0]), false, 'Video identity must match')
const backwards = copy(timed);backwards.chapters[0].paragraphs[1].startSeconds = 1
assert.equal(isManagedTranscript(backwards, manifest.sessions[0]), false, 'Times must be monotonic')
const unlabeledEstimate = copy(timed);unlabeledEstimate.chapters[0].paragraphs[1].timingSource = undefined
assert.equal(isManagedTranscript(unlabeledEstimate, manifest.sessions[0]), false, 'Estimates must be marked')
const missingCue = copy(timed);delete missingCue.chapters[0].paragraphs[0].youtubeCueLine
assert.equal(isManagedTranscript(missingCue, manifest.sessions[0]), false, 'Verified timing needs provenance')
console.log('Managed Library: catalog, course/session, Study Notes flags, transcript/timing and URL validations passed.')
