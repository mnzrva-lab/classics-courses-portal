import course1 from './archive-sessions/course-1.json'
import course2 from './archive-sessions/course-2.json'
import course3 from './archive-sessions/course-3.json'
import course4 from './archive-sessions/course-4.json'
import course5 from './archive-sessions/course-5.json'
import course6 from './archive-sessions/course-6.json'
import course7 from './archive-sessions/course-7.json'
import course8 from './archive-sessions/course-8.json'
import course9 from './archive-sessions/course-9.json'
import course10 from './archive-sessions/course-10.json'
import course11 from './archive-sessions/course-11.json'
import course12 from './archive-sessions/course-12.json'
import course13 from './archive-sessions/course-13.json'
import course14 from './archive-sessions/course-14.json'
import course15 from './archive-sessions/course-15.json'
import course16 from './archive-sessions/course-16.json'
import course17 from './archive-sessions/course-17.json'

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
  8: course8 as ArchiveSessionFile,
  9: course9 as ArchiveSessionFile,
  10: course10 as ArchiveSessionFile,
  11: course11 as ArchiveSessionFile,
  12: course12 as ArchiveSessionFile,
  13: course13 as ArchiveSessionFile,
  14: course14 as ArchiveSessionFile,
  15: course15 as ArchiveSessionFile,
  16: course16 as ArchiveSessionFile,
  17: course17 as ArchiveSessionFile,
}

export function archiveSessionsFor(courseNumber: number, offeringSlug: string) {
  return detailFiles[courseNumber]?.offerings?.[offeringSlug]?.sessions ?? []
}

export function allArchiveSessions() {
  return Object.entries(detailFiles).flatMap(([courseNumber, file]) =>
    Object.entries(file.offerings).flatMap(([offeringSlug, offering]) =>
      offering.sessions.map((session) => ({
        ...session,
        courseNumber: Number(courseNumber),
        offeringSlug,
        offeringLabel: offering.label,
      }))
    )
  )
}
