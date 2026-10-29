import { notFound, redirect } from 'next/navigation'
import { getPublishedLibraryClass } from '@/lib/managed-library-content'

export default async function OldClassLink({ params }: {
  params: Promise<{ programSlug: string; offeringSlug: string; sessionSlug: string }>
}) {
  const { programSlug, offeringSlug, sessionSlug } = await params
  const item = await getPublishedLibraryClass(programSlug, offeringSlug, sessionSlug)
  if (!item) notFound()
  redirect(item.session.href)
}
