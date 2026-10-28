import { notFound, redirect } from 'next/navigation'
import { getPublishedLibraryOffering } from '@/lib/managed-library-content'

export default async function OldOfferingLink({ params }: {
  params: Promise<{ programSlug: string; offeringSlug: string }>
}) {
  const { programSlug, offeringSlug } = await params
  const offering = await getPublishedLibraryOffering(programSlug, offeringSlug)
  if (!offering) notFound()
  redirect(offering.href)
}
