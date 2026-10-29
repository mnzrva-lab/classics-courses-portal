import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

for (const path of ['lib/public-content.ts', 'lib/published-cover.ts']) {
  const text = readFileSync(new URL('../' + path, import.meta.url), 'utf8')
  assert.ok(text.includes('?ref=main'), 'Approved private main must be referenced by ' + path)
  assert.ok(!text.includes('qa-auto-covers-search-standalone-2026'),
    'Temporary cover/Search QA repository must never be used by a release: ' + path)
  assert.ok(!text.includes('qa-disposable-offering-2026-10-28'),
    'Original temporary QA repository must never be used by a release: ' + path)
}
console.log('Approved private content source test passed for text and WebP.')
