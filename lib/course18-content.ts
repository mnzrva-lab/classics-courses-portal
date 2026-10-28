import 'server-only'
import rawFallbackSchedule from '@/content/classics/course-18-schedule.json'
import { readPublishedJSON } from '@/lib/public-content'

export type Course18Session = {
  id: string
  label: string
  startsAt: string
  endsAt: string
  rebroadcastAt?: string
}
export type Course18Schedule = {
  schemaVersion: 1
  course: 18
  sourceTimezone: 'America/Phoenix'
  sourceLabel: string
  sessions: Course18Session[]
}

export function isCourse18Schedule(candidate: unknown): candidate is Course18Schedule {
  if (!candidate || typeof candidate !== 'object') return false
  const schedule = candidate as Partial<Course18Schedule>
  if (schedule.schemaVersion !== 1 || schedule.course !== 18) return false
  if (schedule.sourceTimezone !== 'America/Phoenix' || typeof schedule.sourceLabel !== 'string') return false
  if (!Array.isArray(schedule.sessions) || schedule.sessions.length === 0 || schedule.sessions.length > 30) return false

  const ids = new Set<string>()
  for (const value of schedule.sessions as unknown[]) {
    if (!value || typeof value !== 'object') return false
    const session = value as Partial<Course18Session>
    if (typeof session.id !== 'string' || !session.id.trim() || ids.has(session.id)) return false
    if (typeof session.label !== 'string' || !session.label.trim()) return false
    if (typeof session.startsAt !== 'string' || !session.startsAt.endsWith('Z')) return false
    if (typeof session.endsAt !== 'string' || !session.endsAt.endsWith('Z')) return false
    const start = Date.parse(session.startsAt)
    const end = Date.parse(session.endsAt)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false
    if (session.rebroadcastAt !== undefined &&
        (typeof session.rebroadcastAt !== 'string' || !Number.isFinite(Date.parse(session.rebroadcastAt)))) return false
    ids.add(session.id)
  }
  return true
}

const fallback = rawFallbackSchedule as Course18Schedule

export async function getCourse18Schedule(): Promise<Course18Schedule> {
  return (await readPublishedJSON('classics/course-18/schedule.json', isCourse18Schedule)) ?? fallback
}
