import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const raw = readFileSync('/tmp/tibetan-hub.html', 'utf8')
const html = raw.replace(/&#(?:x27|39);|&apos;/gi, "'")
const heading = html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1]

assert.equal(heading, "'OG MIN", "Term title should not include square brackets")
assert.ok(html.includes("['OG MIN]"), "Source excerpts must preserve the original square brackets")
assert.ok(html.includes('Open exact passage'), "The term hub needs a source passage link")
console.log('Tibetan source excerpts keep brackets; title stays clean.')
