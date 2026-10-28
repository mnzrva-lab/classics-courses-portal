import { getManagedLibraryIndex } from '@/lib/managed-library-content'
import { readApprovedCover } from '@/lib/published-cover'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: {
  params: Promise<{ programSlug: string; scope: string }>
}) {
  const { programSlug, scope } = await params
  const index = await getManagedLibraryIndex()
  const registered = index?.entries.some(entry =>
    (scope === 'shared'
      ? entry.programSlug === programSlug && entry.source === 'managed-v1'
      : entry.programSlug === programSlug && entry.offeringSlug === scope &&
        (entry.source === 'managed-v1' || entry.source === 'standalone-v1')))
  if (!registered) return new Response('Not found', { status: 404 })
  const image = await readApprovedCover(programSlug, scope)
  if (!image) return new Response('Not found', { status: 404 })
  return new Response(new Uint8Array(image.bytes), {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(image.bytes.byteLength),
      'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=30',
      'ETag': '"' + image.etag + '"',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
