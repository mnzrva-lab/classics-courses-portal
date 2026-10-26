import 'server-only'

/**
 * Server-side published-content reader for the private Library repository.
 *
 * Only files explicitly listed below may be read by this website. Never
 * expose LIBRARY_CONTENT_GITHUB_TOKEN to client components or responses.
 */
const CONTENT_REPO = 'mnzrva-lab/classics-library-content'

const ALLOWED_PUBLISHED_MARKDOWN = {
  'perfection-of-wisdom/overview.md': true,
} as const

export type PublishedMarkdownPath = keyof typeof ALLOWED_PUBLISHED_MARKDOWN

export async function readPublishedMarkdown(path: PublishedMarkdownPath): Promise<string | null> {
  const token = process.env.LIBRARY_CONTENT_GITHUB_TOKEN?.trim()
  if (!token) return null

  const url = `https://api.github.com/repos/${CONTENT_REPO}/contents/published/${path}?ref=main`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'classics-courses-portal',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) return null

    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') return null

    const file = payload as { type?: unknown; encoding?: unknown; content?: unknown }
    if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string') return null

    const content = Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8')
    if (!content.trim() || Buffer.byteLength(content, 'utf8') > 20000) return null

    return content
  } catch {
    // Keep the page available if GitHub is temporarily unreachable.
    return null
  }
}
