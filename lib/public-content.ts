import 'server-only'

/**
 * Preview content pilot: fetch only explicitly approved files from the private
 * GitHub repository. The token remains exclusively in the Netlify server
 * environment and must never be returned to browser clients.
 */
const CONTENT_REPO = 'mnzrva-lab/classics-library-content'
const PUBLISHED_FILES = {
  'perfection-of-wisdom/overview.md': { kind: 'markdown', maxBytes: 20000 },
  'classics/course-18/schedule.json': { kind: 'json', maxBytes: 60000 },
  'classics/course-18/recordings.json': { kind: 'json', maxBytes: 12000 },
  'living-lam-rim/term-7/schedule.json': { kind: 'json', maxBytes: 12000 },
  'home/latest-courses.json': { kind: 'json', maxBytes: 100000 },
  'perfection-of-wisdom/introduction-q-a-2021/first-qa-winter-2021/transcript.json': { kind: 'json', maxBytes: 100000 },
} as const

export type PublishedMarkdownPath = 'perfection-of-wisdom/overview.md'
export type PublishedJsonPath = 'classics/course-18/schedule.json' | 'classics/course-18/recordings.json' | 'living-lam-rim/term-7/schedule.json' | 'home/latest-courses.json'
  | 'perfection-of-wisdom/introduction-q-a-2021/first-qa-winter-2021/transcript.json'

async function readApprovedSource(path: keyof typeof PUBLISHED_FILES): Promise<string | null> {
  if (!Object.prototype.hasOwnProperty.call(PUBLISHED_FILES, path)) return null

  const token = process.env.LIBRARY_CONTENT_GITHUB_TOKEN?.trim()
  if (!token) return null

  const url = `https://api.github.com/repos/${CONTENT_REPO}/contents/published/${path}?ref=main`
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'classics-courses-portal',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null

    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object') return null
    const file = payload as { type?: unknown; encoding?: unknown; content?: unknown }
    if (file.type !== 'file' || file.encoding !== 'base64' || typeof file.content !== 'string') return null

    const buffer = Buffer.from(file.content.replace(/\s/g, ''), 'base64')
    if (buffer.byteLength === 0 || buffer.byteLength > PUBLISHED_FILES[path].maxBytes) return null
    const decoded = buffer.toString('utf8')
    return decoded.trim() ? decoded : null
  } catch {
    // Keep the published teaching page available when GitHub is unreachable.
    return null
  }
}

export async function readPublishedMarkdown(path: PublishedMarkdownPath): Promise<string | null> {
  return readApprovedSource(path)
}

export async function readPublishedJSON<T>(
  path: PublishedJsonPath,
  validate: (candidate: unknown) => candidate is T,
): Promise<T | null> {
  const raw = await readApprovedSource(path)
  if (!raw) return null

  try {
    const data: unknown = JSON.parse(raw)
    return validate(data) ? data : null
  } catch {
    return null
  }
}
