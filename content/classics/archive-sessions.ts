import course1 from './archive-sessions/course-1.json'
import course2 from './archive-sessions/course-2.json'
import course3 from './archive-sessions/course-3.json'
import course4 from './archive-sessions/course-4.json'
import course5 from './archive-sessions/course-5.json'
import course6 from './archive-sessions/course-6.json'
import course7 from './archive-sessions/course-7.json'

export type ArchiveSession = {
  code: string
  name: string
  date?: string
  dateISO?: string
  teacher?: string
  duration: string
  url: string
  videoId?: string
  sourceTitle?: string
  published?: string
}

type ArchiveOfferingSessions = {
  label: string
  sessions: ArchiveSession[]
}

type ArchiveSessionFile = {
  schemaVersion: number
  course: number
  offerings: Record<string, ArchiveOfferingSessions>
}

const detailFiles: Record<number, ArchiveSessionFile> = {
  1: course1 as ArchiveSessionFile,
  2: course2 as ArchiveSessionFile,
  3: course3 as ArchiveSessionFile,
  4: course4 as ArchiveSessionFile,
  5: course5 as ArchiveSessionFile,
  6: course6 as ArchiveSessionFile,
  7: course7 as ArchiveSessionFile,
}

export function archiveSessionsFor(courseNumber: number, offeringSlug: string) {
  return detailFiles[courseNumber]?.offerings?.[offeringSlug]?.sessions ?? []
}
