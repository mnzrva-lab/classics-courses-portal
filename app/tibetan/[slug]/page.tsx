import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { recordTibetanFlashcard, toggleTibetanBookmark } from '../actions'

export const dynamic = 'force-dynamic'

function sessionPath(session: any) {
  const course = session?.courses
  const offering = session?.course_offerings
  if (!course?.slug || !offering?.slug || !session?.slug) return null
  return `/courses/${course.slug}/${offering.slug}/${session.slug}`
}

function sessionLabel(session: any) {
  const course = session?.courses
  const offering = session?.course_offerings
  return [course?.canonical_number ? `Course ${course.canonical_number}` : course?.title, offering?.label, session?.code ? `${session.code} · ${session.title}` : session?.title].filter(Boolean).join(' · ')
}

export default async function TibetanTermPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  const { data: term } = await supabase.from('tibetan_terms').select('id, slug, transliteration, english_meaning, explanation, aliases').eq('slug', slug).eq('status', 'published').single()
  if (!term) notFound()

  const [{ data: sources }, bookmarkResult, progressResult, settingsResult] = await Promise.all([
    supabase.from('tibetan_term_sources').select('id, source_label, external_url, note, sort_order, sessions(id, slug, code, title, courses(slug, title, canonical_number), course_offerings(slug, label))').eq('term_id', term.id).order('sort_order').order('created_at'),
    userId ? supabase.from('user_tibetan_bookmarks').select('term_id').eq('user_id', userId).eq('term_id', term.id).maybeSingle() : Promise.resolve({ data: null } as any),
    userId ? supabase.from('user_tibetan_flashcard_progress').select('learning_state, review_count, correct_count, last_reviewed_at').eq('user_id', userId).eq('term_id', term.id).maybeSingle() : Promise.resolve({ data: null } as any),
    userId ? supabase.from('user_settings').select('save_bookmarks, save_progress').eq('user_id', userId).maybeSingle() : Promise.resolve({ data: null } as any),
  ])

  const bookmarked = Boolean(bookmarkResult.data)
  const progress = progressResult.data as any
  const settings = settingsResult.data as any
  const canSaveBookmarks = settings?.save_bookmarks ?? true
  const canSaveProgress = settings?.save_progress ?? true
  const learningState = progress?.learning_state === 'learned' ? 'Learned' : progress?.learning_state === 'learning' ? 'Learning' : 'New'
  const returnPath = `/tibetan/${slug}`

  return (
    <main className="container page">
      <div className="actions" style={{ marginTop: 0, marginBottom: 18 }}><Link className="button" href="/tibetan">← Tibetan glossary</Link><Link className="button" href="/tibetan/flashcards">Study flashcards</Link></div>
      <div className="eyebrow">Tibetan term</div>
      <h1>{term.transliteration}</h1>
      <p className="lead">{term.english_meaning}</p>

      <div className="actions">
        {userId && (canSaveBookmarks || bookmarked) ? <form action={toggleTibetanBookmark.bind(null, term.id, returnPath)}><button className="button" type="submit">{bookmarked ? '★ Bookmarked' : '☆ Bookmark term'}</button></form> : userId ? <Link className="button" href="/account">Bookmarks are off</Link> : <Link className="button" href="/login">Sign in to bookmark</Link>}
        {userId ? <span className="pill">{learningState}</span> : null}
      </div>

      {(term.aliases ?? []).length ? <div className="actions" style={{ marginTop: 18 }}>{(term.aliases ?? []).map((alias: string) => <span className="pill" key={alias}>{alias}</span>)}</div> : null}

      {term.explanation ? <section className="section card"><div className="eyebrow">Explanation</div><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{term.explanation}</div></section> : null}

      {userId ? <section className="section card">
        <div className="eyebrow">Flashcard progress</div><h2 style={{ fontSize: 30 }}>{learningState}</h2>
        <p className="meta">{progress?.review_count ? `Reviewed ${progress.review_count} time${progress.review_count === 1 ? '' : 's'}.` : 'You have not reviewed this flashcard yet.'}</p>
        {canSaveProgress ? <div className="actions"><form action={recordTibetanFlashcard.bind(null, term.id, 'learning', returnPath)}><button className="button" type="submit">Keep learning</button></form><form action={recordTibetanFlashcard.bind(null, term.id, 'learned', returnPath)}><button className="button sage" type="submit">Mark learned</button></form></div> : <Link className="button" href="/account">Progress tracking is off</Link>}
      </section> : null}

      <section className="section card sage">
        <div className="eyebrow">Teaching sources</div><h2 style={{ fontSize: 32 }}>Where this term appears</h2>
        {(sources ?? []).length ? (sources ?? []).map((source: any) => {
          const linkedSession = source.sessions
          const classPath = sessionPath(linkedSession)
          const label = source.source_label || sessionLabel(linkedSession) || 'Source reference'
          return <div key={source.id} style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
            <strong>{label}</strong>{linkedSession && source.source_label ? <div className="meta" style={{ marginTop: 5 }}>{sessionLabel(linkedSession)}</div> : null}{source.note ? <p style={{ marginBottom: 0 }}>{source.note}</p> : null}
            <div className="actions">{classPath ? <Link className="button" href={classPath}>Open source class</Link> : null}{source.external_url ? <a className="button" href={source.external_url} target="_blank" rel="noreferrer">Open source reference</a> : null}</div>
          </div>
        }) : <p className="meta">No teaching-source references have been added for this term yet.</p>}
      </section>
      <section className="section"><Link className="button" href="/tibetan">← All Tibetan terms</Link></section>
    </main>
  )
}
