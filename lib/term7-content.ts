import 'server-only'
import rawFallback from '@/content/living-lam-rim/term-7-schedule.json'
import { readPublishedJSON } from '@/lib/public-content'
import { isWeeklyTerm7Schedule, type WeeklyTermSchedule } from '@/lib/weekly-term-schedule'

const fallback: WeeklyTermSchedule = rawFallback as WeeklyTermSchedule

/** Live schedule is managed in the approved private content repository. */
export async function getTerm7Schedule(): Promise<WeeklyTermSchedule> {
  const remote = await readPublishedJSON('living-lam-rim/term-7/schedule.json', isWeeklyTerm7Schedule)
  return remote ?? fallback
}
