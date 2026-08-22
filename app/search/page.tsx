import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CopyReference from '@/components/copy-reference'
import { submitTeachingSearch } from './actions'

export const dynamic = 'force-dynamic'

function clip(text: string, length = 320) {
  return text.length > length ? `${text.slice(0, length).trim()}…` : text
}

function formatTimestamp(seconds: number | null | undefined) {
  if (seconds == null) return null
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return hours > 0 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; course?: string; teacher?: string; type?: string }>
}) {
  const params = await searchParams
  const query = (params.q ?? '').trim()
  const courseFilter = (params.course ?? '').trim()
  const teacherFilter = (params.teacher ?? '').trim()
  const typeFilter = (params.type ?? '').trim()
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  let rawResults: any[] = []
  if (query) {
    const select = `
      id, body, speaker, start_seconds,
      transcripts!inner(
        status,
        sessions!inner(
          slug, code, title, session_type, status,
          courses!inner(slug, title, canonical_number, status),
          course_offerings(slug, label, status),
          session_teachers(teachers(full_name))
        )
      )
    `
    const primary = await supabase
      .from('transcript_paragraphs')
      .select(select)
      .textSearch('search_vector', query, { type: 'websearch', config: 'english' })
      .eq('is_active', true)
      .eq('transcripts.status', 'published')
      .eq('transcripts.sessions.status', 'published')
      .eq('transcripts.sessions.courses.status', 'published')
      .limit(100)

    rawResults = primary.data ?? []
    if (!rawResults.length) {
      const fallback = await supabase
        .from('transcript_paragraphs')
        .select(select)
        .ilike('body', `%${query.replace(/[%_]/g, '')}%`)
        .eq('is_active', true)
        .eq('transcripts.status', 'published')
        .eq('transcripts.sessions.status', 'published')
        .eq('transcripts.sessions.courses.status', 'published')
        .limit(100)
      rawResults = fallback.data ?? []
    }
  }

  const courseOptions = Array.from(new Map(rawResults.map((result: any) => {
    const course = result.transcripts?.sessions?.courses
    return course?.slug ? [course.slug, course.canonical_number ? `Classics Course ${course.canonical_number} · ${course.title}` : course.title] : null
  }).filter(Boolean) as [string, string][]).entries())
  const teacherOptions = Array.from(new Set(rawResults.flatMap((result: any) =>
    (result.transcripts?.sessions?.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean)
  ))).sort()
  const typeOptions = Array.from(new Set(rawResults.map((result: any) => result.transcripts?.sessions?.session_type).filter(Boolean))).sort()

  const results = rawResults.filter((result: any) => {
    const session = result.transcripts?.sessions
    const course = session?.courses
    const teachers = (session?.session_teachers ?? []).map((item: any) => item.teachers?.full_name).filter(Boolean)
    return (!courseFilter || course?.slug === courseFilter) && (!teacherFilter || teachers.includes(teacherFilter)) && (!typeFilter || session?.session_type === typeFilter)
  })
  const advancedActive = Boolean(courseFilter || teacherFilter || typeFilter)

  return (
    <main className="container page search-page-simple">
      <div className="eyebrow">Search</div>
      <h1>Search the teachings</h1>

      <form className="search-primary" action={submitTeachingSearch}>
        <span aria-hidden="true">⌕</span>
        <input type="search" name="q" defaultValue={query} autoFocus placeholder="Search courses and transcripts…" aria-label="Search courses and transcripts" />
        <button type="submit">Search</button>
      </form>
      <p className="meta search-privacy">Search history is only saved if you turn it on in <Link href="/account">Privacy &amp; Data</Link>. {userId ? <Link href={query ? `/my-notes?q=${encodeURIComponent(query)}` : '/my-notes'}>Search My Notes separately →</Link> : null}</p>

      {query ? (
        <>
          <details className="advanced-search" open={advancedActive}>
            <summary>Advanced search</summary>
            <form action="/search" method="get" className="advanced-search-form">
              <input type="hidden" name="q" value={query} />
              <label>Course<select name="course" defaultValue={courseFilter}><option value="">All courses</option>{courseOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Teacher<select name="teacher" defaultValue={teacherFilter}><option value="">All teachers</option>{teacherOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Type<select name="type" defaultValue={typeFilter}><option value="">All session types</option>{typeOptions.map((value) => <option key={value} value={value}>{String(value).replace(/_/g, ' ')}</option>)}</select></label>
              <div className="actions"><button className="button sage" type="submit">Apply filters</button>{advancedActive ? <Link className="button" href={`/search?q=${encodeURIComponent(query)}`}>Clear filters</Link> : null}</div>
            </form>
          </details>

          <section className="section search-results-simple">
            <div className="section-head"><div><h2>{results.length} result{results.length === 1 ? '' : 's'} for “{query}”</h2></div></div>
            {results.length ? results.map((result: any) => {
              const session = result.transcripts?.sessions
              const course = session?.courses
              const offering = session?.course_offerings
              const timestamp = formatTimestamp(result.start_seconds)
              const href = course?.slug && offering?.slug && session?.slug ? `/courses/${course.slug}/${offering.slug}/${session.slug}#paragraph-${result.id}` : null
              const reference = [course?.canonical_number ? `Course ${course.canonical_number}` : course?.title, offering?.label, session?.title, timestamp].filter(Boolean).join(' · ')
              return <article className="search-result-row" key={result.id}>
                <div className="meta">{timestamp ? `${timestamp} · ` : ''}{course?.title ?? 'Course'}{offering?.label ? ` · ${offering.label}` : ''}{session?.code ? ` · ${session.code}` : ''}</div>
                <div className="search-result-copy">{result.speaker ? <strong>{result.speaker}: </strong> : null}{clip(result.body)}</div>
                {href ? <div className="actions"><Link className="button" href={href}>Open passage</Link><CopyReference reference={reference} path={href} /></div> : null}
              </article>
            }) : <p className="meta">No published transcript text matched this search.</p>}
          </section>
        </>
      ) : <section className="section search-empty"><p className="meta">Start typing above. Advanced filters appear only after you have search results to refine.</p></section>}
    </main>
  )
}
