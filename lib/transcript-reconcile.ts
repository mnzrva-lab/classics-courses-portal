export type ExistingTranscriptParagraph = {
  id: string
  speaker: string | null
  body: string
  start_seconds: number | null
  sort_order: number
  is_active?: boolean | null
}

export type ParsedTranscriptParagraph = {
  section_id: string | null
  speaker: string | null
  body: string
  start_seconds: number | null
  sort_order: number
}

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizedSpeaker(value: string | null) {
  return normalizeText(value ?? '')
}

function tokenDice(a: string, b: string) {
  const left = new Set(normalizeText(a).split(' ').filter(Boolean))
  const right = new Set(normalizeText(b).split(' ').filter(Boolean))
  if (!left.size && !right.size) return 1
  if (!left.size || !right.size) return 0

  let intersection = 0
  for (const token of left) if (right.has(token)) intersection += 1
  return (2 * intersection) / (left.size + right.size)
}

function similarity(existing: ExistingTranscriptParagraph, next: ParsedTranscriptParagraph) {
  const exactBody = normalizeText(existing.body) === normalizeText(next.body)
  if (exactBody && normalizedSpeaker(existing.speaker) === normalizedSpeaker(next.speaker)) return 1

  let score = tokenDice(existing.body, next.body)

  if (normalizedSpeaker(existing.speaker) === normalizedSpeaker(next.speaker)) score += 0.08
  else if (existing.speaker && next.speaker) score -= 0.08

  if (existing.start_seconds != null && next.start_seconds != null) {
    const delta = Math.abs(existing.start_seconds - next.start_seconds)
    if (delta <= 2) score += 0.12
    else if (delta <= 10) score += 0.06
  }

  const distance = Math.abs(existing.sort_order - next.sort_order)
  score -= Math.min(distance, 12) * 0.008

  return score
}

export function reconcileParagraphIds(
  existingRows: ExistingTranscriptParagraph[],
  parsedRows: ParsedTranscriptParagraph[],
) {
  const unused = new Map(existingRows.map((row) => [row.id, row]))
  const matchedIds: Array<string | null> = Array(parsedRows.length).fill(null)

  // Exact text matches are safest and should win before any fuzzy comparison.
  for (let index = 0; index < parsedRows.length; index += 1) {
    const next = parsedRows[index]
    const candidates = Array.from(unused.values())
      .filter((row) => normalizeText(row.body) === normalizeText(next.body))
      .sort((a, b) => {
        const aSpeaker = normalizedSpeaker(a.speaker) === normalizedSpeaker(next.speaker) ? 0 : 1
        const bSpeaker = normalizedSpeaker(b.speaker) === normalizedSpeaker(next.speaker) ? 0 : 1
        return aSpeaker - bSpeaker || Math.abs(a.sort_order - next.sort_order) - Math.abs(b.sort_order - next.sort_order)
      })

    if (candidates[0]) {
      matchedIds[index] = candidates[0].id
      unused.delete(candidates[0].id)
    }
  }

  // For edited paragraphs, preserve an ID only when the textual match remains strong.
  // A conservative threshold is intentional: keeping an old bookmark attached to an
  // outdated archived paragraph is safer than silently moving it to the wrong text.
  for (let index = 0; index < parsedRows.length; index += 1) {
    if (matchedIds[index]) continue
    const next = parsedRows[index]
    const candidates = Array.from(unused.values())
      .map((row) => ({ row, score: similarity(row, next) }))
      .filter((item) => item.score >= 0.68)
      .sort((a, b) => b.score - a.score || Math.abs(a.row.sort_order - next.sort_order) - Math.abs(b.row.sort_order - next.sort_order))

    if (candidates[0]) {
      matchedIds[index] = candidates[0].row.id
      unused.delete(candidates[0].row.id)
    }
  }

  return {
    matchedIds,
    retiredIds: Array.from(unused.keys()),
    preservedCount: matchedIds.filter(Boolean).length,
    newCount: matchedIds.filter((id) => !id).length,
  }
}
