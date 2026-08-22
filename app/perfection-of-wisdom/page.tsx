import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PerfectionOfWisdomPage() {
  const supabase = await createClient()
  const { data: course } = await supabase
    .from('courses')
    .select('id, slug, title, subtitle, description, course_offerings(id, slug, label, starts_on, ends_on, status, sort_order)')
    .eq('slug', 'perfection-of-wisdom')
    .eq('status', 'published')
    .maybeSingle()

  const offerings = ((course as any)?.course_offerings ?? [])
    .filter((item: any) => item.status === 'published')
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  return (
    <main className="container page">
      <div className="eyebrow">Text study</div>
      <h1>Perfection of Wisdom</h1>
      <p className="lead">{course?.subtitle ?? 'String of White Lotuses · PAD MA DKAR PO’I PHRENG BA'}</p>
      {course?.description ? <p className="lead" style={{ fontSize: 17 }}>{course.description}</p> : null}

      <section className="section">
        <div className="section-head">
          <div>
            <div className="eyebrow">Teaching archive</div>
            <h2>Study by season</h2>
            <p>Each season or Course Offering opens into its classes, recordings, Study Notes, and Reference Transcripts.</p>
          </div>
        </div>

        {offerings.length ? (
          <div className="grid two">
            {offerings.map((offering: any) => (
              <Link className="card" href={`/courses/perfection-of-wisdom/${offering.slug}`} key={offering.id}>
                <div className="eyebrow">Perfection of Wisdom</div>
                <h2 style={{ fontSize: 30 }}>{offering.label}</h2>
                <div className="go">Open study →</div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card cream">
            <h2 style={{ fontSize: 30 }}>The teaching archive is being organized.</h2>
            <p className="meta">This page is now the permanent home for the Perfection of Wisdom text study. Seasons and classes will appear here as they are published.</p>
          </div>
        )}
      </section>
    </main>
  )
}
