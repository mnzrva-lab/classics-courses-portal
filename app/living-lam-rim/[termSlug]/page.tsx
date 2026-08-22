import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import OfferingSessionList from '@/components/offering-session-list'

export const dynamic = 'force-dynamic'

function dateOnly(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateRange(startsOn: string | null, endsOn: string | null) {
  const start = dateOnly(startsOn)
  const end = dateOnly(endsOn)
  if (!start && !end) return null
  const full = (date: Date) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
  if (!start) return full(end!)
  if (!end || startsOn === endsOn) return full(start)
  const startShort = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(start)
  const endFull = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(end)
  return `${startShort} – ${endFull}`
}

function termLabel(slug: string) {
  const match = slug.match(/term-(\d+)/i)
  return match ? `Term ${match[1]}` : 'Living Lam Rim term'
}

function materialLabel(type: string) {
  const labels: Record<string, string> = {
    reading: 'Reading', slides: 'Slides', audio: 'Audio', video: 'Video', document: 'Document', link: 'Link', other: 'Resource',
  }
  return labels[type] ?? 'Resource'
}

export default async function LivingLamRimTermPage({ params }: { params: Promise<{ termSlug: string }> }) {
  const { termSlug } = await params
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title')
    .eq('kind', 'living_lam_rim')
    .eq('status', 'published')
    .maybeSingle()
  if (!course) notFound()

  const { data: offering } = await supabase
    .from('course_offerings')
    .select('id, slug, label, starts_on, ends_on, status')
    .eq('course_id', course.id)
    .eq('slug', termSlug)
    .eq('status', 'published')
    .maybeSingle()
  if (!offering) notFound()

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, slug, code, title, session_type, session_date, recording_url, audio_url, sort_order,
      session_teachers(teachers(full_name)),
      transcripts(status),
      study_notes(status),
      materials(material_type, status)
    `)
    .eq('offering_id', offering.id)
    .eq('status', 'published')
    .order('sort_order')

  const sessionIds = (sessions ?? []).map((session: any) => session.id)
  const { data: progressRows } = userId && sessionIds.length
    ? await supabase.from('user_session_progress').select('session_id, started_at, completed_at').eq('user_id', userId).in('session_id', sessionIds)
    : { data: [] as any[] }
  const progressMap = new Map((progressRows ?? []).map((row: any) => [row.session_id, row]))
  const completedCount = (sessions ?? []).filter((session: any) => progressMap.get(session.id)?.completed_at).length
  const progressPercent = (sessions ?? []).length ? Math.round((completedCount / (sessions ?? []).length) * 100) : 0

  let classIndex = 0
  const sessionCards = (sessions ?? []).map((session: any) => {
    if (session.session_type === 'class') classIndex += 1
    const transcriptPublished = (session.transcripts ?? []).some((item: any) => item.status === 'published')
    const notesPublished = (session.study_notes ?? []).some((item: any) => item.status === 'published')
    const materialBadges = Array.from(new Set((session.materials ?? [])
      .filter((item: any) => item.status === 'published')
      .map((item: any) => materialLabel(item.material_type)))) as string[]
    const progress = progressMap.get(session.id) as any
    return {
      id: session.id,
      href: `/courses/${course.slug}/${offering.slug}/${session.slug}`,
      code: session.code || (session.session_type === 'class' ? `C${classIndex}` : '•'),
      title: session.title,
      sessionType: session.session_type,
      sessionDate: session.session_date,
      teacherNames: (session.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean),
      completed: Boolean(progress?.completed_at),
      inProgress: Boolean(progress?.started_at && !progress?.completed_at),
      badges: [
        session.recording_url ? 'Recording' : null,
        !session.recording_url && session.audio_url ? 'Audio' : null,
        notesPublished ? 'Study Notes' : null,
        transcriptPublished ? 'Transcript' : null,
        ...materialBadges,
      ].filter(Boolean) as string[],
    }
  })

  const range = dateRange(offering.starts_on, offering.ends_on)
  const label = termLabel(offering.slug)

  return (
    <main className="container page living-lam-rim-term-page">
      <Link className="living-term-back" href="/living-lam-rim">← Living Lam Rim</Link>

      <header className="living-term-course-head">
        <div className="eyebrow">{label}</div>
        <h1>{offering.label}</h1>
        <div className="living-term-course-meta">
          {range ? <span>{range}</span> : null}
          <span>{(sessions ?? []).length} sessions</span>
        </div>
      </header>

      {userId ? (
        <section className="living-term-progress" aria-label="Term study progress">
          <div><span className="eyebrow">Your study</span><strong>{completedCount} of {(sessions ?? []).length} sessions completed</strong></div>
          <div className="offering-progress-line" aria-label={`${progressPercent}% complete`}><span style={{ width: `${progressPercent}%` }} /></div>
          <strong>{progressPercent}%</strong>
        </section>
      ) : null}

      <section className="section living-term-study-section">
        <div className="living-term-study-head">
          <div className="eyebrow">Course content</div>
          <h2>Study this term</h2>
        </div>
        {sessionCards.length ? <OfferingSessionList sessions={sessionCards} /> : <p className="meta">No published classes are available in this term yet.</p>}
      </section>
    </main>
  )
}
