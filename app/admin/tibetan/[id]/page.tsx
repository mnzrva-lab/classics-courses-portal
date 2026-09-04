import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addTibetanSource, deleteTibetanSource } from '../actions'

export const dynamic = 'force-dynamic'

export default async function TibetanTermAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') redirect('/my-learning')

  const { data: term } = await supabase
    .from('tibetan_terms')
    .select('id, slug, transliteration, english_meaning, status')
    .eq('id', id)
    .single()

  if (!term) notFound()

  const { data: sources } = await supabase
    .from('tibetan_term_sources')
    .select('id, session_id, source_label, external_url, note, sort_order')
    .eq('term_id', term.id)
    .order('sort_order')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, code, title')
    .order('starts_at', { ascending: true })

  const sessionMap = new Map((sessions ?? []).map((session: any) => [session.id, session]))

  return (
    <main className="container page">
      <div className="actions" style={{ marginTop: 0, marginBottom: 18 }}>
        <Link className="button" href="/admin/tibetan">← Tibetan glossary</Link>
        {term.status === 'published' ? <Link className="button" href={`/tibetan/${term.slug}`}>Open student term</Link> : null}
      </div>

      <div className="eyebrow">Admin · Tibetan sources</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>{term.transliteration}</h1>
      <p className="lead">{term.english_meaning}</p>

      <section className="section card">
        <div className="eyebrow">Teaching sources</div>
        <h2 style={{ fontSize: 32 }}>Source references</h2>
        <p className="meta">Link this glossary term to a class, a direct passage URL, or another source. These references appear on the public term page only when the term itself is published.</p>

        {(sources ?? []).length ? (sources ?? []).map((source: any) => {
          const session = source.session_id ? sessionMap.get(source.session_id) as any : null
          return (
            <div key={source.id} style={{ padding: '16px 0', borderTop: '1px solid var(--line)' }}>
              <strong>{source.source_label || (session ? `${session.code ? `${session.code} · ` : ''}${session.title}` : 'Source reference')}</strong>
              {session && source.source_label ? <div className="meta">{session.code ? `${session.code} · ` : ''}{session.title}</div> : null}
              {source.note ? <p style={{ marginBottom: 0 }}>{source.note}</p> : null}
              {source.external_url ? <div className="actions"><a className="button" href={source.external_url} target="_blank" rel="noreferrer">Open reference</a></div> : null}
              <form action={deleteTibetanSource.bind(null, source.id, term.slug)} style={{ marginTop: 10 }}>
                <button className="button" type="submit">Remove source</button>
              </form>
            </div>
          )
        }) : <p className="meta">No source references have been added yet.</p>}
      </section>

      <section className="section card sage">
        <div className="eyebrow">Add source</div>
        <form className="form-stack" action={addTibetanSource.bind(null, term.id, term.slug)}>
          <label>Source class
            <select className="input" name="session_id" defaultValue="">
              <option value="">No linked class</option>
              {(sessions ?? []).map((session: any) => (
                <option value={session.id} key={session.id}>{session.code ? `${session.code} · ` : ''}{session.title}</option>
              ))}
            </select>
          </label>
          <div className="grid two">
            <label>Source label<input className="input" name="source_label" placeholder="Optional" /></label>
            <label>Sort order<input className="input" name="sort_order" type="number" defaultValue="0" /></label>
          </div>
          <label>External or direct passage URL<input className="input" name="external_url" type="url" placeholder="Optional" /></label>
          <label>Source note<textarea className="input" name="note" rows={4} placeholder="Optional context" /></label>
          <div className="actions"><button className="button red" type="submit">Add source</button></div>
        </form>
      </section>
    </main>
  )
}
