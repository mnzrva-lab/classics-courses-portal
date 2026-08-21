import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addTibetanSource, createTibetanTerm, deleteTibetanSource, updateTibetanTerm } from './actions'

export const dynamic = 'force-dynamic'

function sessionLabel(session: any) {
  const course = session?.courses
  const offering = session?.course_offerings
  return [
    course?.canonical_number ? `Course ${course.canonical_number}` : course?.title,
    offering?.label,
    session?.code ? `${session.code} · ${session.title}` : session?.title,
  ].filter(Boolean).join(' · ')
}

export default async function AdminTibetanPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; saved?: string }>
}) {
  const { created, saved } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') redirect('/my-learning')

  const [{ data: terms }, { data: sourceRows }, { data: sessions }] = await Promise.all([
    supabase
      .from('tibetan_terms')
      .select('id, slug, tibetan_script, transliteration, english_meaning, explanation, aliases, status, sort_order, updated_at')
      .order('sort_order')
      .order('transliteration'),
    supabase
      .from('tibetan_term_sources')
      .select('id, term_id, source_label, external_url, note, sort_order, sessions(id, slug, code, title, courses(slug, title, canonical_number), course_offerings(slug, label))')
      .order('sort_order'),
    supabase
      .from('sessions')
      .select('id, slug, code, title, courses(slug, title, canonical_number), course_offerings(slug, label))
      .order('starts_at', { ascending: true, nullsFirst: false }),
  ])

  const sourcesByTerm = new Map<string, any[]>()
  for (const source of sourceRows ?? []) {
    const list = sourcesByTerm.get(source.term_id) ?? []
    list.push(source)
    sourcesByTerm.set(source.term_id, list)
  }

  const message = created === 'term'
    ? 'Tibetan term created.'
    : created === 'source'
      ? 'Source reference added.'
      : saved === 'term'
        ? 'Tibetan term updated.'
        : saved === 'source-deleted'
          ? 'Source reference removed.'
          : null

  return (
    <main className="container page">
      <div className="actions" style={{ marginTop: 0, marginBottom: 18 }}>
        <Link className="button" href="/admin">← Admin</Link>
        <Link className="button" href="/tibetan">Open student glossary</Link>
      </div>
      <div className="eyebrow">Admin · Tibetan</div>
      <h1>Tibetan glossary</h1>
      <p className="lead">Maintain the glossary as its own study tool. Terms stay separate from transcripts, while source references can point students back to the teachings.</p>

      {message ? <div className="card completed section">{message}</div> : null}

      <section className="section card sage">
        <div className="eyebrow">New term</div>
        <h2 style={{ fontSize: 32 }}>Add a Tibetan term</h2>
        <form className="form-stack" action={createTibetanTerm}>
          <div className="grid two">
            <label>Tibetan script
              <input className="input" name="tibetan_script" placeholder="Optional Tibetan script" />
            </label>
            <label>Transliteration
              <input className="input" name="transliteration" required placeholder="Required" />
            </label>
            <label>English meaning
              <input className="input" name="english_meaning" required placeholder="Required" />
            </label>
            <label>Aliases
              <input className="input" name="aliases" placeholder="Comma-separated alternate forms" />
            </label>
            <label>Status
              <select className="input" name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label>Sort order
              <input className="input" name="sort_order" type="number" defaultValue="0" />
            </label>
          </div>
          <label>Explanation
            <textarea className="input" name="explanation" rows={5} placeholder="Optional explanation or study note" />
          </label>
          <div className="actions"><button className="button red" type="submit">Create term</button></div>
        </form>
      </section>

      <section className="section">
        <div className="eyebrow">Glossary entries</div>
        <h2>{terms?.length ?? 0} term{terms?.length === 1 ? '' : 's'}</h2>

        {(terms ?? []).length ? (terms ?? []).map((term: any) => {
          const termSources = sourcesByTerm.get(term.id) ?? []
          return (
            <div className="card" key={term.id} style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <div className="eyebrow">{term.status} · /tibetan/{term.slug}</div>
                  {term.tibetan_script ? <div style={{ fontSize: 34, marginTop: 4 }}>{term.tibetan_script}</div> : null}
                  <h2 style={{ fontSize: 30, marginBottom: 6 }}>{term.transliteration}</h2>
                  <div>{term.english_meaning}</div>
                </div>
                {term.status === 'published' ? <Link className="button" href={`/tibetan/${term.slug}`}>Open term</Link> : null}
              </div>

              <form className="form-stack" action={updateTibetanTerm.bind(null, term.id, term.slug)} style={{ marginTop: 22 }}>
                <div className="grid two">
                  <label>Tibetan script<input className="input" name="tibetan_script" defaultValue={term.tibetan_script ?? ''} /></label>
                  <label>Transliteration<input className="input" name="transliteration" required defaultValue={term.transliteration} /></label>
                  <label>English meaning<input className="input" name="english_meaning" required defaultValue={term.english_meaning} /></label>
                  <label>Aliases<input className="input" name="aliases" defaultValue={(term.aliases ?? []).join(', ')} /></label>
                  <label>Status
                    <select className="input" name="status" defaultValue={term.status}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                  <label>Sort order<input className="input" name="sort_order" type="number" defaultValue={term.sort_order ?? 0} /></label>
                </div>
                <label>Explanation<textarea className="input" name="explanation" rows={5} defaultValue={term.explanation ?? ''} /></label>
                <div className="actions"><button className="button" type="submit">Save term</button></div>
              </form>

              <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--line)' }}>
                <div className="eyebrow">Teaching sources</div>
                <h3>Source references</h3>
                <p className="meta">A source can point to a class in this portal, an external resource, or simply carry a source label. Exact passage references can be pasted as the external URL when needed.</p>

                {termSources.length ? termSources.map((source: any) => (
                  <div key={source.id} style={{ padding: '12px 0', borderTop: '1px solid var(--line)' }}>
                    <strong>{source.source_label || sessionLabel(source.sessions) || 'Source reference'}</strong>
                    {source.sessions ? <div className="meta">{sessionLabel(source.sessions)}</div> : null}
                    {source.note ? <div className="meta" style={{ marginTop: 5 }}>{source.note}</div> : null}
                    {source.external_url ? <div className="actions"><a className="button" href={source.external_url} target="_blank" rel="noreferrer">Open external source</a></div> : null}
                    <form action={deleteTibetanSource.bind(null, source.id, term.slug)} style={{ marginTop: 8 }}>
                      <button className="button" type="submit">Remove source</button>
                    </form>
                  </div>
                )) : <p className="meta">No source references yet.</p>}

                <form className="form-stack" action={addTibetanSource.bind(null, term.id, term.slug)} style={{ marginTop: 18 }}>
                  <div className="grid two">
                    <label>Source class
                      <select className="input" name="session_id" defaultValue="">
                        <option value="">No linked class</option>
                        {(sessions ?? []).map((session: any) => <option value={session.id} key={session.id}>{sessionLabel(session)}</option>)}
                      </select>
                    </label>
                    <label>Source label<input className="input" name="source_label" placeholder="Optional label" /></label>
                    <label>External or direct passage URL<input className="input" name="external_url" type="url" placeholder="Optional" /></label>
                    <label>Sort order<input className="input" name="sort_order" type="number" defaultValue="0" /></label>
                  </div>
                  <label>Source note<textarea className="input" name="note" rows={3} placeholder="Optional context for this source" /></label>
                  <div className="actions"><button className="button sage" type="submit">Add source</button></div>
                </form>
              </div>
            </div>
          )
        }) : (
          <div className="card"><p className="meta">No glossary terms yet. Add the first term above. Nothing has been invented or pre-populated.</p></div>
        )}
      </section>
    </main>
  )
}
