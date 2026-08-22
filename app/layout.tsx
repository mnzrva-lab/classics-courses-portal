import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SiteNavigation from '@/components/site-navigation'
import TranscriptSync from '@/components/transcript-sync'
import ClassStudyTabs from '@/components/class-study-tabs'
import AdminSessionEnhancer from '@/components/admin-session-enhancer'
import AdminOfferingQuickTools from '@/components/admin-offering-quick-tools'
import AdminOfferingSectionEnhancer from '@/components/admin-offering-section-enhancer'
import TeacherBioEnhancer from '@/components/teacher-bio-enhancer'
import { TELEGRAM_UPDATES_URL } from '@/lib/site-links'
import './globals.css'
import './learning-surfaces.css'
import './portal-shell-home.css'
import './v12-content-pass.css'
import './v12-fixes.css'
import './course-offering-followup.css'
import './compact-refinement.css'
import './admin-compact-pass.css'
import './admin-compact.css'
import './admin-archive-pass.css'
import './admin-bulk-edit.css'
import './admin-collections.css'
import './admin-offering-compact.css'
import './admin-material-compact.css'
import './program-archive-pass.css'
import './student-compact-pass.css'

export const metadata: Metadata = {
  title: 'Classics Courses with Timothy Lowenhaupt',
  description: 'Classics Courses, Living Lam Rim, meditations, and study materials.',
}

type CurrentCourse = { href: string; label: string; title: string } | null

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let isAdmin = false
  let currentCourse: CurrentCourse = null
  const perfectionHref = '/perfection-of-wisdom'
  try {
    const supabase = await createClient()
    const [{ data: claimsData }, { data: offeringRows }] = await Promise.all([
      supabase.auth.getClaims(),
      supabase.from('course_offerings').select('slug, label, starts_on, ends_on, status, courses!inner(slug, title, canonical_number, status)').eq('status', 'published').eq('courses.status', 'published').not('starts_on', 'is', null).order('starts_on', { ascending: false }).limit(30),
    ])
    const userId = claimsData?.claims?.sub as string | undefined
    if (userId) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
      isAdmin = profile?.role === 'admin'
    }
    const today = new Date().toISOString().slice(0, 10)
    const offerings = (offeringRows ?? []) as any[]
    const current = offerings.find((offering) => offering.starts_on <= today && (!offering.ends_on || offering.ends_on >= today))
    const recent = offerings.find((offering) => offering.starts_on <= today)
    const upcoming = [...offerings].filter((offering) => offering.starts_on > today).sort((a, b) => String(a.starts_on).localeCompare(String(b.starts_on)))[0]
    const selected = current ?? recent ?? upcoming
    if (selected) {
      const course = selected.courses as any
      currentCourse = { href: `/courses/${course.slug}/${selected.slug}`, label: course?.canonical_number ? `Classics Course ${course.canonical_number} · ${selected.label}` : `${course?.title ?? 'Course'} · ${selected.label}`, title: course?.title ?? selected.label }
    }
  } catch { isAdmin = false }

  return (
    <html lang="en"><body><div className="portal-shell">
      <SiteNavigation isAdmin={isAdmin} currentCourse={currentCourse} perfectionHref={perfectionHref} />
      <div className="portal-main">
        <header className="portal-topbar">
          <Link className="portal-mobile-brand" href="/"><span className="sidebar-mark" aria-hidden="true">C</span><strong>Classics Courses</strong></Link>
          <form className="portal-search-form" action="/search" method="get" role="search"><span aria-hidden="true">⌕</span><input name="q" type="search" aria-label="Search courses and transcripts" placeholder="Search courses and transcripts" /></form>
          <Link className="portal-notes-link" href="/my-notes">✎ <span>My Notes</span></Link>
        </header>
        {isAdmin ? <AdminOfferingQuickTools /> : null}
        {children}
        <ClassStudyTabs />
        <TeacherBioEnhancer />
        {isAdmin ? <Suspense fallback={null}><AdminOfferingSectionEnhancer /></Suspense> : null}
        {isAdmin ? <Suspense fallback={null}><AdminSessionEnhancer /></Suspense> : null}
        <TranscriptSync />
        <footer className="footer portal-footer"><div className="container portal-footer-inner"><span>Classics Courses with Timothy Lowenhaupt</span><a href={TELEGRAM_UPDATES_URL} target="_blank" rel="noreferrer">Telegram updates ↗</a></div></footer>
      </div>
    </div></body></html>
  )
}
