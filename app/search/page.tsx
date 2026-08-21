import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { submitTeachingSearch } from './actions'

export const dynamic = 'force-dynamic'

function clip(text: string, length = 320) {
  return text.length > length ? `${text.slice(0, length).trim()}…` : text
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const query = (q ?? '').trim()
  const supabase = await createClient()

  let results: any[] = []
  if (query) {
    const { data } = await supabase
      .from('transcript_paragraphs')
      .select(`
        id, body, speaker, start_seconds,
        transcripts!inner(
          status,
          sessions!inner(
            slug, code, title, status,
            courses!inner(slug, title, status),
            course_offerings(slug, label, status)
          )
        )
      `)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
      .eq('is_active', true)
      .eq('transcripts.status', 'published')
      .eq('transcripts.sessions.status', 'published')
      .eq('transcripts.sessions.courses.status', 'published')
      .limit(50)

    results = data ?? []
  }

  return (
    <main className="container page">
      <div className="eyebrow">Search</div>
      <h1 style={{ fontSize: 'clamp(38px, 6vw, 64px)' }}>Search the teachings</h1>
      <p className="lead">Search across published Reference Transcript paragraphs.</p>

      <section className="section card">
        <form className="form-stack" action={submitTeachingSearch}>
          <label>Search transcripts<input className="input" type="search" name="q" defaultValue={query} placeholder="karma, emptiness, death, meditation…" /></label>
          <div className="actions"><button className="button red" type="submit">Search</button></div>
        </form>
        <p className="meta">Search history is not saved unless you turn it on in <Link href="/account">Privacy &amp; Data</Link>.</p>
      </section>

      {query ? (
        <section className="section card">
          <div className="eyebrow">Results</div>
          <h2>{results.length} result{results.length === 1 ? '' : 's'} for “{query}”</h2>
          {results.length ? results.map((result: any) => {
            const transcript = result.transcripts
            const session = transcript?.sessions
            const course = session?.courses
            const offering = session?.course_offerings
            const href = course?.slug && offering?.slug && session?.slug
              ? `/courses/${course.slug}/${offering.slug}/${session.slug}#paragraph-${result.id}`
              : null
            return (
              <div key={result.id} style={{ padding: '18px 0', borderTop: '1px solid var(--line)' }}>
                <div className="meta">{course?.title ?? 'Course'}{offering?.label ? ` · ${offering.label}` : ''}{session?.code ? ` · ${session.code}` : ''}</div>
                <div style={{ lineHeight: 1.7, marginTop: 6 }}>
                  {result.speaker ? <strong>{result.speaker}: </strong> : null}{clip(result.body)}
                </div>
                {href ? <div className="actions"><Link className="button" href={href}>Open result</Link></div> : null}
              </div>
            )
          }) : <p className="meta">No published transcript text matched this search.</p>}
        </section>
      ) : (
        <section className="section card"><p className="meta">Enter a word or phrase to search published transcripts.</p></section>
      )}
    </main>
  )
}
