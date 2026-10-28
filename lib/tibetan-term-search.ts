/** Only Tibetan term names are searchable here. Source quotes are deliberately excluded. */
export function normalizeTibetanTermSearch(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase()
    .replace(/['’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function matchesTibetanTermName(term: string, query: string): boolean {
  const sought = normalizeTibetanTermSearch(query)
  return !sought || normalizeTibetanTermSearch(term).includes(sought)
}
