import course1 from './archive-sessions/course-1.json'

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
}

export function archiveSessionsFor(courseNumber: number, offeringSlug: string) {
  return detailFiles[courseNumber]?.offerings?.[offeringSlug]?.sessions ?? []
}
