import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CourseCatalogClient from './course-catalog-client'

export const dynamic = 'force-dynamic'

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  if (!userId) {
    return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') {
    return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>
  }

  const { data: courses } = await supabase
    .from('courses')
    .select('id, kind, canonical_number, slug, title, subtitle, description, status, sort_order, course_offerings(id, slug, label, status, sort_order)')
    .order('sort_order')

  const notice = saved === 'created' ? 'Program created.' : saved === 'updated' ? 'Course or program updated.' : null

  return (
    <main className="container page admin-courses-page">
      <div className="eyebrow">Admin · Courses &amp; Programs</div>
      <h1>Courses and programs</h1>
      <p className="lead">Keep the catalog compact. Open a course only when you need to edit its details or manage its Course Offerings.</p>

      {notice ? <div className="card completed admin-course-notice">{notice}</div> : null}

      <CourseCatalogClient courses={(courses ?? []) as any} />

      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
