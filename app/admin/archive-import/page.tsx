import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ArchiveImportClient from './archive-import-client'

export const dynamic = 'force-dynamic'

export default async function ArchiveImportPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub as string | undefined
  if (!userId) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') {
    return <main className="container page"><div className="card"><h1>Admin access required</h1></div></main>
  }

  const [{ data: courses }, { data: teachers }, { data: offerings }, { data: sessions }, { data: groups }] = await Promise.all([
    supabase.from('courses').select('id, kind, canonical_number, title, status').neq('status', 'archived').order('sort_order'),
    supabase.from('teachers').select('id, full_name, active').eq('active', true).order('full_name'),
    supabase.from('course_offerings').select('id, course_id, label, status, year, location').neq('status', 'archived').order('year', { ascending: false, nullsFirst: false }).order('sort_order'),
    supabase.from('sessions').select('id, offering_id, code, title, session_type, status, sort_order').order('sort_order'),
    supabase.from('content_groups').select('id, offering_id, kind, label, status, sort_order').neq('status', 'archived').order('sort_order'),
  ])

  return (
    <main className="container page archive-import-page">
      <div className="eyebrow">Admin · Archives</div>
      <h1>Bulk archive import</h1>
      <p className="lead">Import several YouTube playlist CSV files at once, review the detected classes, teachers, dates and session types, then create or update the archive in one pass.</p>

      <div className="note archive-import-note">
        <strong>Archive-safe default</strong>
        <div className="meta">New Course Offerings start as Draft. Imported sessions and playlist resources default to Published inside that Draft container, so you can preview the finished archive without publishing every item one by one.</div>
      </div>

      <ArchiveImportClient
        courses={(courses ?? []) as any}
        teachers={(teachers ?? []) as any}
        offerings={(offerings ?? []) as any}
        sessions={(sessions ?? []) as any}
        groups={(groups ?? []) as any}
      />

      <section className="section"><Link className="button" href="/admin">← Back to admin</Link></section>
    </main>
  )
}
