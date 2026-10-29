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

/** Extract normalized words with the exact search tokenizer for vocabulary indexing. */
export function searchWords(value: string): string[] {
  return tokens(value).map((token) => token.word)
}
