/**
 * The ACI 18 source schedule lists five live teaching blocks, two classes each.
 * We expose ten individual class links without inventing individual start times.
 */
export type Course18TeachingBlock = {
  id: string
  label: string
  startsAt: string
  endsAt: string
  rebroadcastAt?: string
}
export type Course18BlockSchedule = { sessions: Course18TeachingBlock[] }

export type Course18ClassEntry = {
  number: number
  title: string
  href: string
  block: Course18TeachingBlock
}

/** Returns class 1..10 only when each one is backed by a scheduled teaching block. */
export function individualCourse18Classes(schedule: Course18BlockSchedule): Course18ClassEntry[] {
  const entries: Course18ClassEntry[] = []
  const seen = new Set<number>()
  for (const block of schedule.sessions) {
    const pair = /^Classes\s+(\d+)\s*(?:&|and|–|-)\s*(\d+)$/i.exec(block.label.trim())
    if (!pair) continue
    const first = Number(pair[1])
    const second = Number(pair[2])
    if (first < 1 || second > 10 || second !== first + 1) continue
    for (const number of [first, second]) {
      if (seen.has(number)) continue
      seen.add(number)
      entries.push({
        number,
        title: 'Class ' + number,
        href: '/courses/course-18/class-' + number,
        block,
      })
    }
  }
  return entries.sort((a, b) => a.number - b.number)
}

export function formatCourse18Date(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix', weekday: 'long',
    month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(iso))
}

/** The time range belongs to the shared two-class block, not an individual class. */
export function formatCourse18BlockTime(block: Course18TeachingBlock) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
  return formatter.format(new Date(block.startsAt)) + '–' +
    formatter.format(new Date(block.endsAt)) + ' AZ (shared block)'
}
