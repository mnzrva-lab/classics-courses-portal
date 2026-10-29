import assert from 'node:assert/strict'
import { matchesTibetanTermName, normalizeTibetanTermSearch } from '../lib/tibetan-term-search.ts'

assert.equal(normalizeTibetanTermSearch("  'OG   MIN "), 'og min')
assert.equal(matchesTibetanTermName("'OG MIN", 'og min'), true)
assert.equal(matchesTibetanTermName("'OG MIN", "'og min"), true)
assert.equal(matchesTibetanTermName("'OG MIN STUG PO BKOD PA", 'OG MIN'), true)
assert.equal(matchesTibetanTermName('GZUGS KHAMS', 'gzugs'), true)
assert.equal(matchesTibetanTermName("'OG MIN", 'mind'), false)
assert.equal(matchesTibetanTermName('GZUGS KHAMS', 'realm'), false)
assert.equal(matchesTibetanTermName('དགེ་བ', 'དགེ'), true)
assert.equal(matchesTibetanTermName('GZUGS KHAMS', ''), true)

console.log('Tibetan term-name search tests passed')
