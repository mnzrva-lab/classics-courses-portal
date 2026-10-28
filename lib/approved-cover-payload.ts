/**
 * GitHub's Contents API provides inline base64 for files <= 1 MB.
 * Larger files require the documented raw media type. Keep the same
 * four-megabyte publishing contract, and never serve unvalidated bytes.
 */
export const MAX_APPROVED_COVER_BYTES = 4_000_000
const GITHUB_INLINE_LIMIT = 1_000_000

export type GitHubCoverEntry = {
  type?: unknown
  encoding?: unknown
  content?: unknown
  size?: unknown
  sha?: unknown
}
export type VerifiedCover = { bytes: Uint8Array; etag: string }

export async function verifiedGithubCover(
  metadata: GitHubCoverEntry, fetchRaw: () => Promise<Response>,
): Promise<VerifiedCover | null> {
  if (metadata.type !== 'file' || typeof metadata.size !== 'number' ||
      !Number.isInteger(metadata.size) || metadata.size < 20 ||
      metadata.size > MAX_APPROVED_COVER_BYTES ||
      typeof metadata.sha !== 'string' || !/^[a-f0-9]{40,64}$/.test(metadata.sha)) {
    return null
  }
  let buffer: Buffer
  if (metadata.encoding === 'base64' && typeof metadata.content === 'string' &&
      metadata.content.trim()) {
    buffer = Buffer.from(metadata.content.replace(/\s/g, ''), 'base64')
  } else if (metadata.encoding === 'none' && metadata.size > GITHUB_INLINE_LIMIT) {
    const response = await fetchRaw()
    if (!response.ok) return null
    const length = response.headers.get('content-length')
    if (length && Number(length) > MAX_APPROVED_COVER_BYTES) return null
    buffer = Buffer.from(await response.arrayBuffer())
  } else {
    return null
  }
  if (buffer.byteLength !== metadata.size ||
      buffer.toString('ascii', 0, 4) !== 'RIFF' ||
      buffer.toString('ascii', 8, 12) !== 'WEBP' ||
      buffer.readUInt32LE(4) + 8 !== buffer.byteLength ||
      !['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16))) {
    return null
  }
  return { bytes: new Uint8Array(buffer), etag: metadata.sha }
}
