import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
  return [
    course?.canonical_number ? `Course ${course.canonical_number}` : course?.title,
    offering?.label,
    session?.code ? `${session.code} · ${session.title}` : session?.title,
  ].filter(Boolean).join(' · ')
}

export default async function TibetanTermPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: term } = await supabase
    .from('tibetan_terms')
    .select('id, slug, tibetan_script, transliteration, english_meaning, explanation, aliases')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!term) notFound()

  const { data: sources } = await supabase
    .from('tibetan_term_sources')
    .select('id, source_label, external_url, note, sort_order, sessions(id, slug, code, title, courses(slug, title, canonical_number), course_offerings(slug, label))')
    .eq('term_id', term.id)
    .order('sort_order')
    .order('created_at')

  return (
    <main className="container page">
      <div className="actions" style={{ marginTop: 0, marginBottom: 18 }}>
        <Link className="button" href="/tibetan">← Tibetan glossary</Link>
      </div>

      <div className="eyebrow">Tibetan term</div>
      {term.tibetan_script ? <div style={{ fontSize: 'clamp(46px, 8vw, 82px)', lineHeight: 1.2, margin: '14px 0' }}>{term.tibetan_script}</div> : null}
      <h1>{term.transliteration}</h1>
      <p className="lead">{term.english_meaning}</p>

      {(term.aliases ?? []).length ? (
        <div className="actions" style={{ marginTop: 18 }}>
          {(term.aliases ?? []).map((alias: string) => <span className="pill" key={alias}>{alias}</span>)}
        </div>
      ) : null}

      {term.explanation ? (
        <section className="section card">
          <div className="eyebrow">Explanation</div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{term.explanation}</div>
        </section>
      ) : null}

      <section className="section card sage">
        <div className="eyebrow">Teaching sources</div>
        <h2 style={{ fontSize: 32 }}>Where this term appears</h2>
        {(sources ?? []).length ? (sources ?? []).map((source: any) => {
          const linkedSession = source.sessions
          const classPath = sessionPath(linkedSession)
          const label = source.source_label || sessionLabel(linkedSession) || 'Source reference'
          return (
            <div key={source.id} style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
              <strong>{label}</strong>
              {linkedSession && source.source_label ? <div className="meta" style={{ marginTop: 5 }}>{sessionLabel(linkedSession)}</div> : null}
              {source.note ? <p style={{ marginBottom: 0 }}>{source.note}</p> : null}
              <div className="actions">
                {classPath ? <Link className="button" href={classPath}>Open source class</Link> : null}
                {source.external_url ? <a className="button" href={source.external_url} target="_blank" rel="noreferrer">Open source reference</a> : null}
              </div>
            </div>
          )
        }) : <p className="meta">No teaching-source references have been added for this term yet.</p>}
      </section>

      <section className="section"><Link className="button" href="/tibetan">← All Tibetan terms</Link></section>
    </main>
  )
}
