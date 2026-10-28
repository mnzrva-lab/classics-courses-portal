import assert from 'node:assert/strict'
import { matchRanges, searchScore, searchWords } from '../lib/search-match.ts'
import { relatedWordCandidates } from '../lib/search-word-families.ts'

// Keep the precise search behavior and anchored transcript highlighting.
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
assert.equal(searchScore('These classes are popular.', 'class'), 0)
assert.equal(searchScore('A karmic result.', 'karm'), 0)

// Every suggestion is anchored in indexed text, not fabricated by a dictionary.
const actualWords = [...new Set(searchWords(
  'Karma creates karmic causes. Rejoice in rejoicing. The class includes classes. Classic values.'
))]
const findWords = (query, vocabulary = actualWords, allowPrefix = false, limit = 16) =>
  relatedWordCandidates(query, vocabulary, allowPrefix, limit).map(item => item.word)

assert.ok(findWords('karma').includes('karmic'))
assert.ok(findWords('karmic').includes('karma'))
assert.ok(findWords('rejoice').includes('rejoicing'))
assert.ok(findWords('rejoicing').includes('rejoice'))
assert.ok(findWords('class').includes('classes'))
assert.ok(findWords('classes').includes('class'))
assert.ok(!findWords('class').includes('classic'), 'Do not match unrelated class/classic')
assert.deepEqual(findWords('karm'), [], 'Fragments do not match or suggest without explicit prefix mode')
assert.deepEqual(findWords('karm', actualWords, true), ['karma', 'karmic'])
assert.deepEqual(findWords('class karma'), [], 'No broad word-family expansion for multiword queries')

// Nontrivial derivations: these are explicit lexical families, not vague synonyms.
const familyVocabulary = [
  'happiness', 'happier', 'happiest', 'happily', 'happy',
  'wise', 'wisdom', 'wisely',
  'decide', 'decision', 'decisions', 'decisive',
  'create', 'created', 'creation', 'creativity', 'creative',
  'forgive', 'forgiven', 'forgiveness', 'forgiving',
  'compassion', 'compassionate',
  'mind', 'mindfulness', 'mindful',
  'teach', 'teaching', 'teacher', 'taught',
]
for (const [input, expected] of [
  ['happy', 'happiness'],
  ['happiness', 'happy'],
  ['happier', 'happy'],
  ['wise', 'wisdom'],
  ['wisdom', 'wise'],
  ['decide', 'decision'],
  ['decision', 'decisive'],
  ['create', 'creation'],
  ['creation', 'creativity'],
  ['forgive', 'forgiveness'],
  ['forgiveness', 'forgiving'],
  ['compassion', 'compassionate'],
  ['mindful', 'mindfulness'],
  ['teach', 'teacher'],
  ['taught', 'teach'],
]) {
  assert.ok(findWords(input, familyVocabulary).includes(expected), input + ' should suggest ' + expected)
}

// The lemmatizer covers general English morphology without per-word manual entries.
const inflectionVocabulary = ['child', 'children', 'mouse', 'mice', 'knife', 'knives',
  'easy', 'easier', 'teach', 'teaches', 'study', 'studies', 'read', 'reading']
for (const [input, expected] of [
  ['child', 'children'],
  ['children', 'child'],
  ['mouse', 'mice'],
  ['knives', 'knife'],
  ['easier', 'easy'],
  ['study', 'studies'],
  ['read', 'reading'],
]) {
  assert.ok(findWords(input, inflectionVocabulary).includes(expected), input + ' should suggest ' + expected)
}

// Correctness and safety of suggestion display.
assert.deepEqual(findWords('forgive', ['unrelated', 'sunrise']), [], 'Never invent absent forms')
assert.deepEqual(findWords('class', ['classic', 'classical', 'classification']), [])
assert.deepEqual(findWords('decision', ['decoration', 'decade']), [])
assert.deepEqual(findWords('mind', ['minimal', 'mine', 'mindfulness']).filter(w => w !== 'mindfulness'), [])
assert.deepEqual(findWords('karm', actualWords, false), [])
assert.deepEqual(findWords('karm', actualWords, true, 1), ['karma'])
assert.deepEqual(findWords('mindfulness wisdom', familyVocabulary), [], 'Keep multiword search unchanged')
assert.deepEqual(findWords('3', familyVocabulary), [], 'Do not broaden short or numeric queries')
assert.deepEqual(findWords('happy', ['happy', 'happiness', 'happiness']), ['happiness'], 'Deduplicate suggestions')
assert.ok(relatedWordCandidates('happi', familyVocabulary, true)
  .every(item => item.kind === 'prefix'), 'Prefix completions should be explicitly labeled')
assert.ok(relatedWordCandidates('happy', familyVocabulary)
  .every(item => item.kind === 'related'), 'Word-family links should be explicitly labeled')

console.log('Exact word search and expanded English word-family regression tests passed.')
