import Link from 'next/link'
import { notFound } from 'next/navigation'
import LibrarySessionList from '@/components/library-session-list'
import LibraryCourseHero from '@/components/library-course-hero'
import rawCatalog from '@/content/living-lam-rim/catalog.json'
import { getTerm7Schedule } from '@/lib/term7-content'
import { weeklyTermOccurrences, formatArizonaDate, formatArizonaTimeRange, formatTermStartDate } from '@/lib/weekly-term-schedule'

type Session = {
  id: string
  slug: string
  code: string
  label: string
  kind: string
  date: string
  duration: string
  recordingUrl: string
  transcriptSource: string | null
}
type Term = {
  term: number
  slug: string
  title: string | null
  range: string
  note: string | null
  sessions: Session[]
}
type Catalog = { terms: Term[] }

const catalog = rawCatalog as Catalog

export const dynamic = 'force-dynamic'

export default async function LivingLamRimTermPage({ params }: { params: Promise<{ termSlug: string }> }) {
  const { termSlug } = await params
  const term = catalog.terms.find((item) => item.slug === termSlug)
  if (!term) notFound()
  const schedule = term.term === 7 ? await getTerm7Schedule() : null
  // Show the first ten *dates* in the announced Monday recurrence; no ending is implied.
  const firstMondays = schedule ? weeklyTermOccurrences(schedule, 0, 10) : []

  return (
    <main className="container page living-lam-rim-term-page">
      <div className="offering-breadcrumbs"><Link href="/living-lam-rim">Living Lam Rim</Link><span>/</span><span>Term {term.term}</span></div>

      <LibraryCourseHero
        eyebrow={'Living Lam Rim · Term ' + term.term}
        title={schedule?.title ?? (term.title ?? 'Term ' + term.term)}
        subtitle={schedule ? 'Weekly live classes' : undefined}
        artwork={schedule ? {
          src: '/images/living-lam-rim/term-7/BG.webp',
          alt: 'A figure overlooking a green city and mountains beneath flowing digital patterns',
          width: 1920,
          height: 1080,
          position: 'center',
        } : undefined}
        facts={schedule ? [
          'From ' + formatArizonaDate(schedule.startDate + 'T14:00:00Z'),
          'Every Monday · ' + formatArizonaTimeRange(schedule),
        ] : [term.range, term.sessions.length + ' recording' + (term.sessions.length === 1 ? '' : 's')]}
        description={schedule
          ? (schedule.endDate ? 'Through ' + formatTermStartDate(schedule.endDate) : 'The final class date has not been announced.')
          : (term.note ?? undefined)}
      />

      {schedule ? (
        <section className="section compact-section llr-live-term">
          <div className="section-head">
            <div>
              <div className="eyebrow">Live course · Living Lam Rim Term 7</div>
              <h2>First 10 classes</h2>
              <p>Every Monday · {formatArizonaTimeRange(schedule)} (UTC−7)</p>
              <p className="meta">{schedule.endDate ? `Through ${formatTermStartDate(schedule.endDate)}` : 'The final class date has not been announced.'}</p>
            </div>
          </div>
          <div className="actions llr-live-actions">
            <a className="button sage" href="/living-lam-rim/term-7/calendar">＋ Add weekly classes to calendar</a>
            <Link className="button" href="/calendar">View all upcoming classes</Link>
          </div>
          <LibrarySessionList rows={firstMondays.map((session, index) => ({
            href: '/living-lam-rim/term-7/monday-' + session.date,
            code: 'C' + (index + 1),
            title: 'Class ' + (index + 1),
            meta: formatArizonaDate(session.startsAt),
            status: formatArizonaTimeRange(schedule),
          }))} />
          <p className="meta llr-calendar-note">The class labels follow the first ten Mondays in the announced schedule. The final number of classes has not been confirmed. </p>
          <p className="meta llr-calendar-note">{schedule.endDate ? `The calendar series ends on ${formatTermStartDate(schedule.endDate)}.` : 'The calendar download repeats every Monday without an end date until the final date is confirmed.'}</p>
        </section>
      ) : null}

      {term.sessions.length ? (
      <section className="section compact-section">
        <div className="section-head"><div><div className="eyebrow">Course content</div><h2>Classes &amp; review</h2></div></div>
        <LibrarySessionList rows={term.sessions.map((session) => ({
          href: `/living-lam-rim/${term.slug}/${session.slug}`,
          code: session.code,
          title: session.label,
          meta: `${session.date} · ${session.duration}`,
          status: session.transcriptSource ? 'Recording · Transcript' : 'Recording',
        }))} />
      </section>
      ) : null}
    </main>
  )
}
