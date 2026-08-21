import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createTeacher, updateTeacher } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminTeachersPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
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

  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, slug, full_name, bio, active')
    .order('active', { ascending: false })
    .order('full_name')

  const notice = saved === 'created' ? 'Teacher added.' : saved === 'updated' ? 'Teacher updated.' : null

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Teachers</div>
      <h1>Teachers</h1>
      <p className="lead">Manage the teacher list used when creating and editing sessions.</p>

      {notice ? <div className="card completed" style={{ marginTop: 20 }}>{notice}</div> : null}

      <section className="section card sage">
        <div className="eyebrow">Add teacher</div>
        <h2 style={{ fontSize: 30 }}>New teacher</h2>
        <form className="form-stack" action={createTeacher}>
          <div className="grid two">
            <label>Full name<input className="input" name="full_name" placeholder="Teacher name" required /></label>
            <label>Slug<input className="input" name="slug" placeholder="Optional URL-safe name" /></label>
          </div>
          <label>Bio<textarea className="input" name="bio" rows={4} placeholder="Optional" /></label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="checkbox" name="active" defaultChecked /> Active and available for session assignment
          </label>
          <div className="actions"><button className="button red" type="submit">Add teacher</button></div>
        </form>
      </section>

      <section className="section">
        <div className="eyebrow">Current teachers</div>
        <h2 style={{ fontSize: 32 }}>Edit teacher details</h2>
        {(teachers ?? []).map((teacher) => (
          <div className="card" key={teacher.id} style={{ marginBottom: 18 }}>
            <form className="form-stack" action={updateTeacher.bind(null, teacher.id)}>
              <div className="grid two">
                <label>Full name<input className="input" name="full_name" defaultValue={teacher.full_name} required /></label>
                <label>Slug<input className="input" name="slug" defaultValue={teacher.slug} /></label>
              </div>
              <label>Bio<textarea className="input" name="bio" rows={4} defaultValue={teacher.bio ?? ''} /></label>
              <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="checkbox" name="active" defaultChecked={teacher.active} /> Active and available for session assignment
              </label>
              <div className="actions"><button className="button" type="submit">Save teacher</button></div>
            </form>
          </div>
        ))}
      </section>

      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
