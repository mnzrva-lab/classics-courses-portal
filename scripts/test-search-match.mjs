import assert from 'node:assert/strict'
import { matchRanges, searchScore, relatedWordCandidates, searchWords } from '../lib/search-match.ts'

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


const actualWords = new Set(searchWords(
  'Karma creates karmic causes. Rejoice in rejoicing. The class includes classes. Classic values.'
))
const findWords = (query, allowPrefix = false) =>
  relatedWordCandidates(query, actualWords, allowPrefix).map((item) => item.word)
assert.ok(findWords('karma').includes('karmic'))
assert.ok(findWords('karmic').includes('karma'))
assert.ok(findWords('rejoice').includes('rejoicing'))
assert.ok(findWords('rejoicing').includes('rejoice'))
assert.ok(findWords('class').includes('classes'))
assert.ok(findWords('classes').includes('class'))
assert.ok(!findWords('class').includes('classic'), 'class must not imply classic')
assert.deepEqual(findWords('karm'), [], 'Prefixes do not become matches automatically')
assert.deepEqual(findWords('karm', true), ['karma', 'karmic'], 'A whole-word miss can suggest actual words')
assert.deepEqual(findWords('class karma'), [], 'Multiword searches retain their exact behavior')
assert.equal(searchScore('These classes are popular.', 'class'), 0, 'Exact word search remains precise')
assert.equal(searchScore('A karmic result.', 'karm'), 0, 'Partial fragments must not match')

console.log('Exact search and optional word-form suggestions passed regression checks')

