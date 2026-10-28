import { getPublishedLibraryClass } from '@/lib/managed-library-content'

type Params = { programSlug: string; offeringSlug: string; sessionSlug: string }

export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  const { programSlug, offeringSlug, sessionSlug } = await params
  const { searchParams } = new URL(request.url)
  const content = searchParams.get('content')
  const format = searchParams.get('format')
  if ((content !== 'notes' && content !== 'transcript') ||
      (format !== 'txt' && format !== 'docx')) {
    return new Response('Invalid download request.', { status: 400 })
  }
  const item = await getPublishedLibraryClass(programSlug, offeringSlug, sessionSlug)
  if (!item) return new Response('Class not found.', { status: 404 })
  const query = new URLSearchParams({ content, format })
  if (item.offering.source === 'existing-aci17') {
    if (content !== 'transcript') return new Response('Study Notes not found.', { status: 404 })
    query.set('collection', 'course17')
    query.set('session', item.session.code)
    return Response.redirect(new URL('/downloads?' + query.toString(), request.url), 307)
  }
  return Response.redirect(new URL(item.session.href + '/download?' + query.toString(), request.url), 307)
}
