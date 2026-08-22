import type { Metadata } from 'next'
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

export const metadata: Metadata = {
  title: 'Classics Courses with Timothy Lowenhaupt',
  description: 'Classics Courses, Living Lam Rim, meditations, and study materials.',
}

type CurrentCourse = {
  href: string
  label: string
  title: string
} | null

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let isAdmin = false
  let currentCourse: CurrentCourse = null
  let perfectionHref = '/perfection-of-wisdom'

  try {
    const supabase = await createClient()
    const [{ data: claimsData }, { data: offeringRows }, { data: perfectionCourse }] = await Promise.all([
      supabase.auth.getClaims(),
      supabase
        .from('course_offerings')
        .select('slug, label, starts_on, ends_on, status, courses!inner(slug, title, canonical_number, status)')
        .eq('status', 'published')
        .eq('courses.status', 'published')
        .not('starts_on', 'is', null)
        .order('starts_on', { ascending: false })
        .limit(30),
      supabase
        .from('courses')
        .select('slug, title, course_offerings(slug, status, sort_order)')
        .eq('slug', 'perfection-of-wisdom')
        .eq('status', 'published')
        .maybeSingle(),
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
    const upcoming = [...offerings]
      .filter((offering) => offering.starts_on > today)
      .sort((a, b) => String(a.starts_on).localeCompare(String(b.starts_on)))[0]
    const selected = current ?? recent ?? upcoming

    if (selected) {
      const course = selected.courses as any
      const courseLabel = course?.canonical_number
        ? `Classics Course ${course.canonical_number} · ${selected.label}`
        : `${course?.title ?? 'Course'} · ${selected.label}`
      currentCourse = {
        href: `/courses/${course.slug}/${selected.slug}`,
        label: courseLabel,
        title: course?.title ?? selected.label,
      }
    }

    if (perfectionCourse) {
      const course = perfectionCourse as any
      const offering = (course.course_offerings ?? [])
        .filter((item: any) => item.status === 'published')
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
      if (offering) perfectionHref = `/courses/${course.slug}/${offering.slug}`
    }
  } catch {
    isAdmin = false
  }

  return (
    <html lang="en">
      <body>
        <div className="portal-shell">
          <SiteNavigation isAdmin={isAdmin} currentCourse={currentCourse} perfectionHref={perfectionHref} />

          <div className="portal-main">
            <header className="portal-topbar">
              <Link className="portal-mobile-brand" href="/">
                <span className="sidebar-mark" aria-hidden="true">C</span>
                <strong>Classics Courses</strong>
              </Link>
              <form className="portal-search-form" action="/search" method="get" role="search">
                <span aria-hidden="true">⌕</span>
                <input name="q" type="search" aria-label="Search courses and transcripts" placeholder="Search courses and transcripts" />
              </form>
              <Link className="portal-notes-link" href="/my-notes">✎ <span>My Notes</span></Link>
            </header>

            {isAdmin ? <AdminOfferingQuickTools /> : null}
            {children}
            <ClassStudyTabs />
            <TeacherBioEnhancer />
            {isAdmin ? <AdminOfferingSectionEnhancer /> : null}
            {isAdmin ? <AdminSessionEnhancer /> : null}
            <TranscriptSync />

            <footer className="footer portal-footer">
              <div className="container portal-footer-inner">
                <span>Classics Courses with Timothy Lowenhaupt</span>
                <a href={TELEGRAM_UPDATES_URL} target="_blank" rel="noreferrer">Telegram updates ↗</a>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  )
}
