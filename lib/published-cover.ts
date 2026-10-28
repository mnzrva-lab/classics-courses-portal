import 'server-only'
import { cache } from 'react'

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
    const response = await fetch(
      'https://api.github.com/repos/' + repo + '/contents/published/' + path + '?ref=qa-auto-covers-search-standalone-2026',
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + token,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'classics-courses-portal',
        },
        next: { revalidate: 60 },
        signal: AbortSignal.timeout(7000),
      },
    )
    if (!response.ok) return null
    const entry: unknown = await response.json()
    if (!entry || typeof entry !== 'object') return null
    const file = entry as { type?: unknown; encoding?: unknown; content?: unknown; size?: unknown; sha?: unknown }
    if (file.type !== 'file' || file.encoding !== 'base64' ||
        typeof file.content !== 'string' || typeof file.size !== 'number' ||
        file.size < 16 || file.size > 4_000_000) return null
    const buffer = Buffer.from(file.content.replace(/\s/g, ''), 'base64')
    if (buffer.byteLength !== file.size ||
        buffer.toString('ascii', 0, 4) !== 'RIFF' ||
        buffer.toString('ascii', 8, 12) !== 'WEBP') return null
    return {
      bytes: new Uint8Array(buffer),
      etag: typeof file.sha === 'string' ? file.sha : '',
    }
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
