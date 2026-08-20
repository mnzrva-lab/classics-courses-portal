import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateSession } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminSessionPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params
  const { saved } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined

  if (!userId) return <main className="container page"><div className="card"><h1>Sign in required</h1><Link className="button" href="/login">Sign in</Link></div></main>

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>

  const { data: session } = await supabase
    .from('sessions')
    .select('id, code, title, session_type, session_date, starts_at, ends_at, source_timezone, recording_url, audio_url, zoom_url, required_for_completion, status')
    .eq('id', id)
    .single()

  if (!session) notFound()

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Session</div>
      <h1>{session.code ? `${session.code} · ` : ''}{session.title}</h1>
      <p className="lead">Edit the teaching details students see. Date/time fields currently use ISO timestamps so timezone information stays exact.</p>
      {saved === '1' ? <div className="card completed" style={{ marginTop: 20 }}>Saved.</div> : null}

      <form className="section card form-stack" action={updateSession.bind(null, session.id)}>
        <label>Code<input className="input" name="code" defaultValue={session.code ?? ''} placeholder="C1 or M1" /></label>
        <label>Title<input className="input" name="title" defaultValue={session.title} required /></label>
        <label>Session date<input className="input" type="date" name="session_date" defaultValue={session.session_date ?? ''} /></label>
        <label>Start timestamp<input className="input" name="starts_at" defaultValue={session.starts_at ?? ''} placeholder="2026-08-20T19:00:00+08:00" /></label>
        <label>End timestamp<input className="input" name="ends_at" defaultValue={session.ends_at ?? ''} placeholder="2026-08-20T20:30:00+08:00" /></label>
        <label>Source timezone<input className="input" name="source_timezone" defaultValue={session.source_timezone ?? ''} placeholder="Asia/Taipei" /></label>
        <label>Recording URL<input className="input" type="url" name="recording_url" defaultValue={session.recording_url ?? ''} /></label>
        <label>Audio URL<input className="input" type="url" name="audio_url" defaultValue={session.audio_url ?? ''} /></label>
        <label>Zoom URL<input className="input" type="url" name="zoom_url" defaultValue={session.zoom_url ?? ''} /></label>
        <label>Status
          <select className="input" name="status" defaultValue={session.status}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="checkbox" name="required_for_completion" defaultChecked={session.required_for_completion} />
          Required for course completion
        </label>
        <div className="actions">
          <button className="button red" type="submit">Save session</button>
          <Link className="button" href="/admin">Back to admin</Link>
        </div>
      </form>
    </main>
  )
}
