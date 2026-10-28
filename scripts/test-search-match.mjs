import assert from 'node:assert/strict'
import { matchRanges, searchScore } from '../lib/search-match.ts'

const example = "There's a level called ok-min ['OG MIN], a Buddha paradise called ['OG MIN STUG PO BKOD PA]."
assert.deepEqual(
  matchRanges(example, 'OG MIN').map(({ start, end }) => example.slice(start, end)),
  ['OG MIN', 'OG MIN'],
)
assert.deepEqual(
  matchRanges(example, "'OG MIN").map(({ start, end }) => example.slice(start, end)),
  ['OG MIN', 'OG MIN'],
)
assert.equal(searchScore('What makes a dog happy? A moment of mind.', 'OG MIN'), 0)
assert.equal(searchScore('Mindfulness practice', 'mind'), 0)
assert.equal(searchScore('Mindfulness and mind', 'mind') > 0, true)
assert.equal(searchScore('Wisdom comes from practice', 'practice wisdom'), 0)
assert.equal(searchScore('Wisdom comes from practice', 'practice wisdom', 'all') > 0, true)
assert.equal(searchScore('Learn wisdom.', 'WISDOM') > 0, true)

console.log('Search phrase and word-boundary regression checks passed')
