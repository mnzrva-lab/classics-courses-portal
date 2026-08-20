import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  if (!userId) {
    return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') {
    return <main className="container page"><div className="card"><h1>Admin access has not been assigned</h1><p>Your study account is working. Admin access is assigned separately.</p><Link className="button" href="/my-learning">Back to My Learning</Link></div></main>
  }

  const { data } = await supabase.from('sessions').select('id, code, title, status, session_date').order('starts_at', { ascending: true, nullsFirst: false })
  const sessions = data ?? []

  return (
    <main className="container page">
      <div className="eyebrow">Admin</div>
      <h1>Teaching content</h1>
      <p className="lead">Manage sessions and publishing details.</p>
      <section className="section card">
        <h2>Sessions</h2>
        {sessions.map((session) => (
          <div key={session.id} style={{ padding: '14px 0', borderTop: '1px solid var(--line)' }}>
            <strong>{session.code ? `${session.code} · ` : ''}{session.title}</strong>
            <div className="meta">{session.session_date ?? 'No date'} · {session.status}</div>
            <div className="actions"><Link className="button" href={`/admin/sessions/${session.id}`}>Edit</Link></div>
          </div>
        ))}
      </section>
    </main>
  )
}
