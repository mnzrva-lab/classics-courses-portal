import 'server-only'
import { cache } from 'react'
import { verifiedGithubCover, type GitHubCoverEntry } from '@/lib/approved-cover-payload'

const repo = 'mnzrva-lab/classics-library-content'
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type ApprovedCover = { bytes: Uint8Array; etag: string }

/** Approved WebP only. No arbitrary private GitHub file can be read. */
export const readApprovedCover = cache(async (
  programSlug: string, scope: string,
): Promise<ApprovedCover | null> => {
  if (!slug.test(programSlug) || !slug.test(scope)) return null
  const isShared = scope === 'shared'
  if (isShared && !/^classics-course-(?:[1-9]|1[0-8])$/.test(programSlug)) return null
  const path = isShared
    ? 'library/' + programSlug + '/cover.webp'
    : 'library/' + programSlug + '/' + scope + '/cover.webp'
  const token = process.env.LIBRARY_CONTENT_GITHUB_TOKEN?.trim()
  if (!token) return null
  try {
    const url = 'https://api.github.com/repos/' + repo + '/contents/published/' + path + '?ref=main'
    const sharedHeaders = {
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'classics-courses-portal',
    }
    // GitHub supplies metadata and base64 content for normal small WebP files.
    const response = await fetch(url, {
      headers: { ...sharedHeaders, Accept: 'application/vnd.github.object+json' },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(7000),
    })
    if (!response.ok) return null
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') return null

    // For WebP files above 1 MB GitHub returns encoding "none" rather
    // than inline base64; fetch the documented raw representation instead.
    return verifiedGithubCover(payload as GitHubCoverEntry, () => fetch(url, {
      headers: { ...sharedHeaders, Accept: 'application/vnd.github.raw+json' },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(7000),
    }))
  } catch { return null }
})

export async function managedCoverUrl(
  programSlug: string, offeringSlug: string, allowShared: boolean,
): Promise<string | null> {
  if (await readApprovedCover(programSlug, offeringSlug)) {
    return '/api/approved-cover/' + programSlug + '/' + offeringSlug
  }
  if (allowShared && await readApprovedCover(programSlug, 'shared')) {
    return '/api/approved-cover/' + programSlug + '/shared'
  }
  return null
}
