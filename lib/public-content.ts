import 'server-only'

/**
 * Preview content pilot: fetch only explicitly approved files from the private
 * GitHub repository. The token remains exclusively in the Netlify server
 * environment and must never be returned to browser clients.
 */
const CONTENT_REPO = 'mnzrva-lab/classics-library-content'
const ACI17_TRANSCRIPT_FILES = [
  'classics/course-17/class-01/transcript.json',
  'classics/course-17/class-02/transcript.json',
  'classics/course-17/class-03/transcript.json',
  'classics/course-17/class-04/transcript.json',
  'classics/course-17/class-05/transcript.json',
  'classics/course-17/class-06/transcript.json',
  'classics/course-17/class-07/transcript.json',
  'classics/course-17/class-08/transcript.json',
  'classics/course-17/class-09/transcript.json',
  'classics/course-17/class-10/transcript.json',
] as const

const PUBLISHED_FILES: Record<string, { kind: 'json' | 'markdown'; maxBytes: number }> = {
  'perfection-of-wisdom/overview.md': { kind: 'markdown', maxBytes: 20000 },
  'classics/course-18/schedule.json': { kind: 'json', maxBytes: 60000 },
  'living-lam-rim/term-7/schedule.json': { kind: 'json', maxBytes: 12000 },
  'home/latest-courses.json': { kind: 'json', maxBytes: 100000 },
  'perfection-of-wisdom/introduction-q-a-2021/first-qa-winter-2021/transcript.json': { kind: 'json', maxBytes: 100000 },
  'classics/course-17/manifest.json': { kind: 'json', maxBytes: 60000 },
  ...Object.fromEntries(ACI17_TRANSCRIPT_FILES.map(path => [path, { kind: 'json', maxBytes: 100000 }])),
} as const

export type PublishedMarkdownPath = 'perfection-of-wisdom/overview.md'
export type PublishedJsonPath = 'classics/course-18/schedule.json' | 'living-lam-rim/term-7/schedule.json' | 'home/latest-courses.json'
  | 'perfection-of-wisdom/introduction-q-a-2021/first-qa-winter-2021/transcript.json'
  | 'classics/course-17/manifest.json' | (typeof ACI17_TRANSCRIPT_FILES)[number]

function publishedLibraryFile(path: string): { kind: 'json' | 'markdown'; maxBytes: number } | null {
  // Each accepted path is a fixed file under a validated program/offering/session.
  // There is no generic GitHub fetch endpoint and no unvalidated user path.
  const slug = '[a-z0-9]+(?:-[a-z0-9]+)*'
  if (path === 'library/index.json') return { kind: 'json', maxBytes: 15000 }
  if (new RegExp('^library/' + slug + '/' + slug + '/manifest\\.json$').test(path)) {
    return { kind: 'json', maxBytes: 60000 }
  }
  if (new RegExp('^library/' + slug + '/' + slug + '/' + slug + '/transcript\\.json$').test(path)) {
    return { kind: 'json', maxBytes: 125000 }
  }
  if (new RegExp('^library/' + slug + '/' + slug + '/' + slug + '/study-notes\\.md$').test(path)) {
    return { kind: 'markdown', maxBytes: 80000 }
  }
  return null
}

async function readApprovedSource(path: string): Promise<string | null> {
  const config = Object.prototype.hasOwnProperty.call(PUBLISHED_FILES, path)
    ? PUBLISHED_FILES[path] : publishedLibraryFile(path)
  if (!config) return null

  const token = process.env.LIBRARY_CONTENT_GITHUB_TOKEN?.trim()
  if (!token) return null

  // TEMP QA ONLY: use the private disposable branch on Netlify deploy previews.
  // Netlify production and all other environments MUST keep the real main branch.
  // Remove this branch switch after create/edit/delete validation finishes.
  // QA deployment uses this temporary private ref directly because the
  // Netlify function runtime does not reliably expose the build CONTEXT var.
  // This code exists only on development preview-staging, never on main.
  const contentRef = 'qa-disposable-offering-2026-10-28'
  const url = `https://api.github.com/repos/${CONTENT_REPO}/contents/published/${path}?ref=${encodeURIComponent(contentRef)}`
  try {
    const response = await fetch(url, {
      // Cache the 11 ACI 17 source files briefly on the server so public search
      // and glossary traffic do not trigger 11 private GitHub API calls each time.
      // Approved edits are picked up without redeployment (within 60 seconds).
      ...(path.startsWith('classics/course-17/') || path.startsWith('library/')
        ? { next: { revalidate: 60 } }
        : { cache: 'no-store' as const }),
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
    if (buffer.byteLength === 0 || buffer.byteLength > config.maxBytes) return null
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


export async function readManagedJSON<T>(
  path: string, validate: (candidate: unknown) => candidate is T,
): Promise<T | null> {
  if (publishedLibraryFile(path)?.kind !== 'json') return null
  const raw = await readApprovedSource(path)
  if (!raw) return null
  try {
    const candidate: unknown = JSON.parse(raw)
    return validate(candidate) ? candidate : null
  } catch { return null }
}

export async function readManagedMarkdown(path: string): Promise<string | null> {
  if (publishedLibraryFile(path)?.kind !== 'markdown') return null
  return readApprovedSource(path)
}
