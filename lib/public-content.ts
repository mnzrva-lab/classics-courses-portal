/**
 * Preview-only content source pilot.
 *
 * This deliberately reads from an independent Git branch so a Markdown change
 * does not require a new Netlify deploy. The base URL will move to the separate
 * public Library content repository after the no-redeploy test is verified.
 */
const PILOT_CONTENT_BASE =
  'https://raw.githubusercontent.com/mnzrva-lab/classics-courses-portal/library-content-pilot/public-content'

const CONTENT_FILES = {
  'perfection-of-wisdom/overview.md': true,
} as const

export type PublicContentPath = keyof typeof CONTENT_FILES

export async function readPublicMarkdown(path: PublicContentPath): Promise<string | null> {
  try {
    const response = await fetch(`${PILOT_CONTENT_BASE}/${path}`, {
      cache: 'no-store',
      headers: { Accept: 'text/plain' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) return null

    const content = await response.text()
    if (!content.trim() || content.length > 20000) return null
    return content
  } catch {
    // A temporary GitHub outage must not hide the teaching page.
    return null
  }
}
