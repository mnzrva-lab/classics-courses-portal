import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MeditationManagerClient from './meditation-manager-client'

export const dynamic = 'force-dynamic'

export default async function AdminMeditationsPage({ searchParams }: { searchParams: Promise<{ created?: string; saved?: string }> }) {
  const { created, saved } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>

  const [{ data: meditations }, { data: sessions }, { data: teachers }, { data: instances }] = await Promise.all([
    supabase.from('meditations').select('id, slug, name, description, topics, status').order('name'),
    supabase.from('sessions').select('id, code, title, session_type, courses(title), course_offerings(label)').eq('session_type', 'meditation').order('starts_at', { ascending: false, nullsFirst: false }),
    supabase.from('teachers').select('id, full_name').eq('active', true).order('full_name'),
    supabase.from('meditation_instances').select('id, meditation_id, session_id, teacher_id, title, start_seconds, end_seconds, duration_seconds, audio_url, status, meditations(name), sessions(code, title, courses(title), course_offerings(label)), teachers(full_name)').order('created_at', { ascending: false }),
  ])

  const message = created === 'meditation' ? 'Meditation created.' : created === 'version' ? 'Meditation version linked to its source session.' : saved === 'meditation' ? 'Meditation saved.' : saved === 'version' ? 'Meditation version saved.' : null

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Meditations</div>
      <h1>Meditation library</h1>
      <p className="lead">Keep canonical practices separate from their course-specific versions. Source course, class, teacher and audio remain attached to every version.</p>
      {message ? <div className="card completed admin-course-notice">{message}</div> : null}
      <MeditationManagerClient meditations={(meditations ?? []) as any} sessions={(sessions ?? []) as any} teachers={(teachers ?? []) as any} instances={(instances ?? []) as any} />
      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
