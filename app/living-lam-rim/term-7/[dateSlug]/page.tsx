import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibraryClassHeader from '@/components/library-class-header'
import LibraryClassSection from '@/components/library-class-section'
import ClassSequenceNavigation from '@/components/class-sequence-navigation'
import { getTerm7Schedule } from '@/lib/term7-content'
import { formatArizonaDate, formatArizonaTimeRange } from '@/lib/weekly-term-schedule'

export const dynamic = 'force-dynamic'
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Class labels follow the Monday sequence; recordings and official end date remain unconfirmed. */
export default async function Term7MondayPage({
  params,
}: { params: Promise<{ dateSlug: string }> }) {
  const { dateSlug } = await params
  const date = /^monday-(\d{4}-\d{2}-\d{2})$/.exec(dateSlug)?.[1]
  if (!date) notFound()
  const schedule = await getTerm7Schedule()
  const first = Date.parse(schedule.startDate + 'T12:00:00Z')
  const current = Date.parse(date + 'T12:00:00Z')
  if (!Number.isFinite(current) || new Date(current).toISOString().slice(0, 10) !== date ||
      current < first || (current - first) % WEEK_MS !== 0 ||
      (schedule.endDate && date > schedule.endDate)) notFound()

  const classNumber = Math.floor((current - first) / WEEK_MS) + 1
  const classTitle = 'Class ' + classNumber
  const previousDate = current > first ? new Date(current - WEEK_MS).toISOString().slice(0, 10) : null
  const followingDate = new Date(current + WEEK_MS).toISOString().slice(0, 10)
  const nextDate = !schedule.endDate || followingDate <= schedule.endDate ? followingDate : null
  const start = new Date(date + 'T' + schedule.startTime + ':00-07:00').toISOString()

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/living-lam-rim">Living Lam Rim</Link><span>/</span>
        <Link href="/living-lam-rim/term-7">Term 7 · {schedule.title}</Link><span>/</span>
        <span>{classTitle}</span>
      </div>

      <LibraryClassHeader
        eyebrow="Living Lam Rim · Term 7"
        title={classTitle}
        meta={formatArizonaDate(start) + ' · ' + formatArizonaTimeRange(schedule)}
      />
      <p className="meta">This is a scheduled Monday in the {schedule.title} series. Class numbers follow the weekly dates; recordings and study materials have not been added yet. {schedule.endDate ? 'The last announced date is ' + schedule.endDate + '.' : 'The final class date has not been announced.'}</p>

      <LibraryClassSection id="recording" eyebrow="Recording" title="Recording not added yet">
        <p className="meta">The class recording will be linked here when it is available.</p>
      </LibraryClassSection>

      <LibraryClassSection id="transcript" eyebrow="Reference Transcript" title="Transcript not added yet">
        <p className="meta">Reference Transcript and study materials have not yet been published for this Monday.</p>
      </LibraryClassSection>

      <ClassSequenceNavigation
        previous={previousDate ? {
          href: '/living-lam-rim/term-7/monday-' + previousDate, label: 'Class ' + (classNumber - 1),
        } : null}
        next={nextDate ? {
          href: '/living-lam-rim/term-7/monday-' + nextDate, label: 'Class ' + (classNumber + 1),
        } : null}
        allHref="/living-lam-rim/term-7"
        allLabel="All classes"
      />
    </main>
  )
}
