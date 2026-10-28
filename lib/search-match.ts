/**
 * Search whole words rather than arbitrary character fragments.
 * Leading punctuation in Wylie notation (e.g. 'OG MIN) is ignored for finding,
 * while the original transcription stays unchanged for display and citation.
 */
export type MatchMode = 'phrase' | 'all'
export type MatchRange = { start: number; end: number }

type SearchToken = MatchRange & { word: string }
const tokenPattern = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu

function tokens(value: string): SearchToken[] {
  const result: SearchToken[] = []
  for (const match of value.matchAll(tokenPattern)) {
    const start = match.index ?? 0
    result.push({
      word: match[0].normalize('NFKC').toLocaleLowerCase(),
      start,
      end: start + match[0].length,
    })
  }
  return result
}

/** Return every actual occurrence for highlight and score, using one rule. */
export function matchRanges(text: string, query: string, mode: MatchMode = 'phrase'): MatchRange[] {
  const sought = tokens(query).map((token) => token.word)
  if (!sought.length) return []
  const found = tokens(text)
  if (!found.length) return []

  if (mode === 'all') {
    const set = new Set(found.map((token) => token.word))
    if (!sought.every((word) => set.has(word))) return []
    const words = new Set(sought)
    return found.filter((token) => words.has(token.word))
      .map(({ start, end }) => ({ start, end }))
  }

  const ranges: MatchRange[] = []
  for (let i = 0; i <= found.length - sought.length; i++) {
    if (sought.every((word, offset) => found[i + offset].word === word)) {
      ranges.push({ start: found[i].start, end: found[i + sought.length - 1].end })
      i += sought.length - 1
    }
  }
  return ranges
}

export function searchScore(text: string, query: string, mode: MatchMode = 'phrase'): number {
  const matches = matchRanges(text, query, mode)
  if (!matches.length) return 0
  return (mode === 'phrase' ? 100 : 25) + Math.min(40, matches.length)
}


/**
 * Optional word-form discovery. The exact search/highlighting rules stay intact.
 * These are grammatical relatives or curated word families, never AI synonyms.
 */
const knownWordFamilies = [
  ['karma', 'karmic', 'karmically'],
  ['rejoice', 'rejoices', 'rejoiced', 'rejoicing'],
  ['compassion', 'compassionate', 'compassionately'],
  ['meditate', 'meditates', 'meditated', 'meditating', 'meditation', 'meditations', 'meditative'],
  ['mind', 'mindful', 'mindfulness', 'mindfully'],
  ['teach', 'teaches', 'teaching', 'teacher', 'teachers', 'taught'],
  ['practice', 'practices', 'practiced', 'practicing', 'practitioner', 'practitioners'],
  ['virtue', 'virtues', 'virtuous', 'virtuously'],
  ['generosity', 'generous', 'generously'],
  ['liberate', 'liberated', 'liberating', 'liberation'],
  ['suffer', 'suffers', 'suffered', 'suffering'],
  ['study', 'studies', 'studied', 'studying'],
] as const

const wordFamilyLookup = new Map<string, ReadonlySet<string>>()
for (const family of knownWordFamilies) {
  const words = new Set<string>(family)
  for (const word of family) wordFamilyLookup.set(word, words)
}

export type WordSuggestion = { word: string; kind: 'related' | 'prefix' }

export function searchWords(value: string): string[] {
  return tokens(value).map((token) => token.word)
}

function inflections(root: string): Set<string> {
  const words = new Set([root])
  if (/[^aeiou]y$/.test(root)) {
    words.add(root.slice(0, -1) + 'ies')
    words.add(root.slice(0, -1) + 'ied')
    words.add(root + 'ing')
  } else {
    words.add(root + (/(?:s|sh|ch|x|z)$/.test(root) ? 'es' : 's'))
    if (root.endsWith('e')) {
      words.add(root + 'd')
      words.add(root.slice(0, -1) + 'ing')
    } else {
      words.add(root + 'ed')
      words.add(root + 'ing')
      if (/[aeiou][^aeiouwxy]$/.test(root) && root.length <= 5) {
        words.add(root + root.at(-1) + 'ed')
        words.add(root + root.at(-1) + 'ing')
      }
    }
  }
  return words
}

function plausibleRoots(word: string): Set<string> {
  const roots = new Set([word])
  if (word.endsWith('ies') || word.endsWith('ied')) roots.add(word.slice(0, -3) + 'y')
  if (word.endsWith('s') && !word.endsWith('ss')) roots.add(word.slice(0, -1))
  if (word.endsWith('es') && /(?:sses|ches|shes|xes|zes)$/.test(word)) roots.add(word.slice(0, -2))
  for (const suffix of ['ing', 'ed']) {
    if (!word.endsWith(suffix)) continue
    const rest = word.slice(0, -suffix.length)
    if (rest.length < 4) continue
    roots.add(rest)
    roots.add(rest + 'e')
    if (/(.)\1$/.test(rest)) roots.add(rest.slice(0, -1))
  }
  return new Set([...roots].filter((root) => /^[a-z]{4,40}$/.test(root)))
}

function inflectionOf(a: string, b: string): boolean {
  for (const root of plausibleRoots(a)) if (inflections(root).has(b)) return true
  for (const root of plausibleRoots(b)) if (inflections(root).has(a)) return true
  return false
}

/**
 * A prefix is suggested only on a whole-word miss, and never counted as a hit.
 * Suggestions still need actual matching results in the current archive.
 */
export function relatedWordCandidates(
  query: string,
  vocabulary: Iterable<string>,
  includePrefix = false,
  limit = 16,
): WordSuggestion[] {
  const parts = searchWords(query)
  if (parts.length !== 1 || !/^[a-z]{4,40}$/.test(parts[0])) return []
  const sought = parts[0]
  const family = wordFamilyLookup.get(sought)
  const candidates: WordSuggestion[] = []
  const seen = new Set<string>()

  for (const value of vocabulary) {
    const word = value.normalize('NFKC').toLocaleLowerCase()
    if (word === sought || seen.has(word) || !/^[a-z]{4,40}$/.test(word)) continue
    let kind: WordSuggestion['kind'] | null = null
    if (family?.has(word) || inflectionOf(sought, word)) kind = 'related'
    else if (includePrefix && word.startsWith(sought) && word.length > sought.length) kind = 'prefix'
    if (!kind) continue
    seen.add(word)
    candidates.push({ word, kind })
  }
  return candidates.sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === 'related' ? -1 : 1) ||
    Math.abs(a.word.length - sought.length) - Math.abs(b.word.length - sought.length) ||
    a.word.localeCompare(b.word),
  ).slice(0, Math.max(0, Math.min(30, limit)))
}
