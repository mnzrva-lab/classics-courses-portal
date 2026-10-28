/** Utilities for inserting private-content offerings into an existing Classics Course. */
export function classicsCourseNumber(programSlug: string): number | null {
  const match = /^classics-course-([1-9]|1[0-8])$/.exec(programSlug)
  return match ? Number(match[1]) : null
}

export function mergeCourseOfferings<T extends { slug: string }>(
  existing: readonly T[],
  managed: readonly T[],
): T[] {
  const replacement = new Map(managed.map(item => [item.slug, item] as const))
  const output = existing.map(item => replacement.get(item.slug) ?? item)
  const seen = new Set(existing.map(item => item.slug))
  for (const item of managed) {
    if (!seen.has(item.slug)) { output.push(item); seen.add(item.slug) }
  }
  return output
}
