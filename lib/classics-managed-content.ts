import 'server-only'
import { cache } from 'react'
import { classicsCourseNumber } from '@/lib/classics-offering-utils'
import {
  getManagedLibraryIndex, getPublishedLibraryOffering, getPublishedLibraryClass,
  type PublishedLibraryClassContent, type PublishedLibraryOffering,
} from '@/lib/managed-library-content'

/**
 * The private content index is a publishing mechanism, not another public
 * library. New offers are inserted into their existing Classics Course page.
 * The original ACI 17 registered alias is not repeated alongside its archive.
 */
export const getManagedClassicsOfferings = cache(async (): Promise<Map<number, PublishedLibraryOffering[]>> => {
  const index = await getManagedLibraryIndex()
  const matches = (index?.entries ?? []).flatMap(entry => {
    const number = classicsCourseNumber(entry.programSlug)
    return entry.source === 'managed-v1' && number !== null
      ? [{ number, entry }] : []
  })
  const resolved = await Promise.all(matches.map(async ({ number, entry }) => ({
    number,
    offering: await getPublishedLibraryOffering(entry.programSlug, entry.offeringSlug),
  })))
  const grouped = new Map<number, PublishedLibraryOffering[]>()
  for (const { number, offering } of resolved) {
    if (!offering || offering.source !== 'managed-v1') continue
    const group = grouped.get(number) ?? []
    group.push(offering)
    grouped.set(number, group)
  }
  return grouped
})

export async function getManagedClassicsOffering(
  courseSlug: string, offeringSlug: string,
): Promise<PublishedLibraryOffering | null> {
  const courseNumber = /^course-([1-9]|1[0-8])$/.exec(courseSlug)
  if (!courseNumber) return null
  const grouped = await getManagedClassicsOfferings()
  return grouped.get(Number(courseNumber[1]))?.find(o => o.offeringSlug === offeringSlug) ?? null
}

export async function getManagedClassicsClass(
  courseSlug: string, offeringSlug: string, sessionSlug: string,
): Promise<PublishedLibraryClassContent | null> {
  const offering = await getManagedClassicsOffering(courseSlug, offeringSlug)
  if (!offering || !offering.sessions.some(session => session.slug === sessionSlug)) return null
  return getPublishedLibraryClass(offering.programSlug, offering.offeringSlug, sessionSlug)
}
