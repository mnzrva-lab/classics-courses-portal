import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../lib/public-content.ts', import.meta.url), 'utf8')
assert.ok(source.includes('contents/published/${path}?ref=main'), 'Approved private main must be the default source')
assert.ok(!source.includes('qa-disposable-offering-2026-10-28'),
  'Do not deploy the temporary fictional content branch to students')
assert.ok(!source.includes('TEMP QA ONLY'), 'Remove all temporary test-only source overrides')
console.log('Approved Library source verification passed: no disposable test branch.')
