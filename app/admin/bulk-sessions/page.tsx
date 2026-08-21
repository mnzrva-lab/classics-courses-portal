import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CourseRelation = { title: string; canonical_number: number | null }

export default async function BulkSessionsAdminPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>

  const { data: offerings } = await supabase
    .from('course_offerings')
    .select('id, label, status, year, sort_order, courses(title, canonical_number)')
    .neq('status', 'archived')
    .order('year', { ascending: false, nullsFirst: false })
    .order('sort_order')

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Bulk session creation</div>
      <h1>Create many sessions at once</h1>
      <p className="lead">Paste a schedule from a spreadsheet or CSV. Every imported session stays Draft until it is reviewed and published.</p>

      <section className="section grid two">
        {(offerings ?? []).map((offering: any) => {
          const course = offering.courses as CourseRelation | null
          return (
            <div className="card" key={offering.id}>
              <div className="eyebrow">{offering.status}</div>
              <h2 style={{ fontSize: 28 }}>{course?.canonical_number ? `Course ${course.canonical_number} · ` : ''}{course?.title ?? 'Program'}</h2>
              <p className="meta">{offering.label}</p>
              <div className="actions"><Link className="button sage" href={`/admin/offerings/${offering.id}/bulk-sessions`}>Open bulk importer</Link></div>
            </div>
          )
        })}
      </section>

      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
