export const revalidate = 60

import ClassicsCourseHub from '@/components/classics-course-hub'

export default async function ClassicsCoursePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params
  return <ClassicsCourseHub courseSlug={courseSlug} />
}
