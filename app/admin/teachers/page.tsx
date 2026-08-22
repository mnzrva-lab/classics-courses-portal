import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TeacherManagerClient from './teacher-manager-client'

export const dynamic = 'force-dynamic'

export default async function AdminTeachersPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>

  const { data: teachers } = await supabase.from('teachers').select('id, slug, full_name, bio, active').order('active', { ascending: false }).order('full_name')
  const notice = saved === 'created' ? 'Teacher added.' : saved === 'updated' ? 'Teacher updated.' : null

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Teachers</div>
      <h1>Teachers</h1>
      <p className="lead">Manage names and bios without keeping every teacher form open at once.</p>
      {notice ? <div className="card completed admin-course-notice">{notice}</div> : null}
      <TeacherManagerClient teachers={(teachers ?? []) as any} />
      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
