import programData from './program.json'
import group1 from './group-1.json'
import group2 from './group-2.json'
import group3 from './group-3.json'
import group4 from './group-4.json'
import group5 from './group-5.json'
import group6 from './group-6.json'
import group7 from './group-7.json'
import group8 from './group-8.json'

export type PerfectionSession = {
  id: string
  slug: string
  code: string
  name: string
  date: string
  duration: string
  recordingUrl: string
  videoId: string | null
  sourceTitle: string
  teacher: string
  transcriptSource: string | null
}

export type PerfectionGroup = {
  id: string
  slug: string
  title: string
  sessions: PerfectionSession[]
}

export type PerfectionProgram = {
  slug: string
  title: string
  eyebrow: string
  subtitle: string
  intro: string
  playlistUrl: string
  facts: {
    majorRealizations: number
    topicsOnPath: number
  }
}

export const perfectionProgram = programData.program as PerfectionProgram
export const perfectionGroups = [group1, group2, group3, group4, group5, group6, group7, group8] as PerfectionGroup[]

export function perfectionGroupBySlug(slug: string) {
  return perfectionGroups.find((group) => group.slug === slug) ?? null
}

export function perfectionSessionBySlug(groupSlug: string, sessionSlug: string) {
  const group = perfectionGroupBySlug(groupSlug)
  if (!group) return null
  const session = group.sessions.find((item) => item.slug === sessionSlug) ?? null
  return session ? { group, session } : null
}
