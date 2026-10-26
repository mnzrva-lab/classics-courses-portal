/**
 * Temporary preview-only connectivity diagnostic.
 * Does not return the GitHub token or any private file contents.
 * Remove before the draft PR is merged.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const host = new URL(request.url).hostname.toLowerCase()
  if (host !== 'deploy-preview-2--thunderous-clafoutis-c6db2e.netlify.app') {
    return new Response(null, { status: 404 })
  }

  const token = process.env.LIBRARY_CONTENT_GITHUB_TOKEN?.trim()
  if (!token) return Response.json({ result: 'missing_runtime_credential' }, { headers: { 'Cache-Control': 'no-store' } })

  try {
    const url = 'https://api.github.com/repos/mnzrva-lab/classics-library-content/contents/published/perfection-of-wisdom/overview.md?ref=main'
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
    if (!response.ok) {
      return Response.json({ result: 'github_request_failed', status: response.status }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const data: unknown = await response.json()
    if (!data || typeof data !== 'object') return Response.json({ result: 'unexpected_github_response' })
    const file = data as { type?: unknown; encoding?: unknown; content?: unknown }
    return Response.json({
      result: file.type === 'file' && file.encoding === 'base64' && typeof file.content === 'string'
        ? 'private_file_reachable'
        : 'unexpected_github_file_format',
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ result: 'github_network_or_timeout_error' }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
