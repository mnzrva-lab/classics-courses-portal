import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createMeditation, createMeditationInstance, updateMeditation, updateMeditationInstance } from './actions'

export const dynamic = 'force-dynamic'

export default async function AdminMeditationsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; saved?: string }>
}) {
  const { created, saved } = await searchParams
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') {
    return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>
  }

  const [{ data: meditations }, { data: sessions }, { data: teachers }, { data: instances }] = await Promise.all([
    supabase.from('meditations').select('id, slug, name, description, topics, status').order('name'),
    supabase
      .from('sessions')
      .select('id, code, title, session_type, courses(title), course_offerings(label)')
      .eq('session_type', 'meditation')
      .order('starts_at', { ascending: false, nullsFirst: false }),
    supabase.from('teachers').select('id, full_name').eq('active', true).order('full_name'),
    supabase
      .from('meditation_instances')
      .select('id, meditation_id, session_id, teacher_id, title, start_seconds, end_seconds, duration_seconds, audio_url, status, meditations(name), sessions(code, title, courses(title), course_offerings(label)), teachers(full_name)')
      .order('created_at', { ascending: false }),
  ])

  const message = created === 'meditation'
    ? 'Meditation created.'
    : created === 'version'
      ? 'Meditation version linked to its source session.'
      : saved === 'meditation'
        ? 'Meditation saved.'
        : saved === 'version'
          ? 'Meditation version saved.'
          : null

  return (
    <main className="container page">
      <div className="eyebrow">Admin · Meditations</div>
      <h1>Meditation library</h1>
      <p className="lead">Create the canonical meditation once, then connect versions from different classes and programs.</p>
      {message ? <div className="card completed" style={{ marginTop: 20 }}>{message}</div> : null}

      <section className="section card">
        <div className="eyebrow">Create canonical meditation</div>
        <h2>One practice, many teaching versions</h2>
        <form className="form-stack" action={createMeditation}>
          <label>Name<input className="input" name="name" placeholder="Golden Room Meditation" required /></label>
          <label>Description<textarea className="input" name="description" rows={4} /></label>
          <label>Topics<input className="input" name="topics" placeholder="karma, emptiness, compassion" /></label>
          <label>Status
            <select className="input" name="status" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <button className="button sage" type="submit">Create meditation</button>
        </form>
      </section>

      {(meditations ?? []).length > 0 ? (
        <section className="section card">
          <div className="eyebrow">Canonical meditations</div>
          <h2>Edit names and topics</h2>
          {(meditations ?? []).map((meditation: any) => (
            <form key={meditation.id} className="form-stack" action={updateMeditation.bind(null, meditation.id)} style={{ padding: '18px 0', borderTop: '1px solid var(--line)' }}>
              <div className="grid two">
                <label>Name<input className="input" name="name" defaultValue={meditation.name} required /></label>
                <label>Status
                  <select className="input" name="status" defaultValue={meditation.status}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              </div>
              <label>Description<textarea className="input" name="description" rows={3} defaultValue={meditation.description ?? ''} /></label>
              <label>Topics<input className="input" name="topics" defaultValue={(meditation.topics ?? []).join(', ')} /></label>
              <div className="actions">
                <button className="button" type="submit">Save meditation</button>
                {meditation.status === 'published' ? <Link className="button" href={`/meditations/${meditation.slug}`}>Open student view</Link> : null}
              </div>
            </form>
          ))}
        </section>
      ) : null}

      <section className="section card">
        <div className="eyebrow">Add version</div>
        <h2>Connect a meditation to a source session</h2>
        <p className="meta">Use this when the same canonical practice appears in Course 8, Living Lam Rim, or another program.</p>
        <form className="form-stack" action={createMeditationInstance}>
          <label>Meditation
            <select className="input" name="meditation_id" required defaultValue="">
              <option value="" disabled>Choose meditation</option>
              {(meditations ?? []).map((meditation: any) => <option key={meditation.id} value={meditation.id}>{meditation.name}</option>)}
            </select>
          </label>
          <label>Source meditation session
            <select className="input" name="session_id" required defaultValue="">
              <option value="" disabled>Choose source session</option>
              {(sessions ?? []).map((session: any) => (
                <option key={session.id} value={session.id}>
                  {session.code ? `${session.code} · ` : ''}{session.title} · {session.courses?.title ?? 'Course'}{session.course_offerings?.label ? ` · ${session.course_offerings.label}` : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="grid two">
            <label>Teacher
              <select className="input" name="teacher_id" defaultValue="">
                <option value="">Use session teacher / not specified</option>
                {(teachers ?? []).map((teacher: any) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
              </select>
            </label>
            <label>Version title<input className="input" name="title" placeholder="Optional" /></label>
            <label>Duration, minutes<input className="input" name="duration_minutes" type="number" min="0" step="0.5" /></label>
            <label>Audio URL<input className="input" name="audio_url" type="url" placeholder="Optional MP3/M4A" /></label>
            <label>Start at seconds<input className="input" name="start_seconds" type="number" min="0" placeholder="For a segment inside a longer class" /></label>
            <label>End at seconds<input className="input" name="end_seconds" type="number" min="0" /></label>
          </div>
          <label>Status
            <select className="input" name="status" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <button className="button sage" type="submit">Add meditation version</button>
        </form>
      </section>

      {(instances ?? []).length > 0 ? (
        <section className="section card">
          <div className="eyebrow">Versions</div>
          <h2>Existing meditation versions</h2>
          {(instances ?? []).map((instance: any) => (
            <form key={instance.id} className="form-stack" action={updateMeditationInstance.bind(null, instance.id)} style={{ padding: '18px 0', borderTop: '1px solid var(--line)' }}>
              <strong>{instance.meditations?.name ?? 'Meditation'} · {instance.sessions?.code ? `${instance.sessions.code} · ` : ''}{instance.sessions?.title ?? 'Source session'}</strong>
              <div className="grid two">
                <label>Version title<input className="input" name="title" defaultValue={instance.title ?? ''} /></label>
                <label>Teacher
                  <select className="input" name="teacher_id" defaultValue={instance.teacher_id ?? ''}>
                    <option value="">Not specified</option>
                    {(teachers ?? []).map((teacher: any) => <option key={teacher.id} value={teacher.id}>{teacher.full_name}</option>)}
                  </select>
                </label>
                <label>Duration, minutes<input className="input" name="duration_minutes" type="number" min="0" step="0.5" defaultValue={instance.duration_seconds ? instance.duration_seconds / 60 : ''} /></label>
                <label>Audio URL<input className="input" name="audio_url" type="url" defaultValue={instance.audio_url ?? ''} /></label>
                <label>Start at seconds<input className="input" name="start_seconds" type="number" min="0" defaultValue={instance.start_seconds ?? ''} /></label>
                <label>End at seconds<input className="input" name="end_seconds" type="number" min="0" defaultValue={instance.end_seconds ?? ''} /></label>
              </div>
              <label>Status
                <select className="input" name="status" defaultValue={instance.status}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <button className="button" type="submit">Save version</button>
            </form>
          ))}
        </section>
      ) : null}

      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
