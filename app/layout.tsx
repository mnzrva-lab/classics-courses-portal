import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import SiteNavigation from '@/components/site-navigation'
import TranscriptSync from '@/components/transcript-sync'
import './globals.css'
import './learning-surfaces.css'
import './portal-shell-home.css'

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
  let perfectionHref = '/other-programs'

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
        .eq('status', 'published')
        .ilike('title', '%Perfection of Wisdom%')
        .limit(1)
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
              <Link className="portal-search-link" href="/search">
                <span aria-hidden="true">⌕</span>
                <span>Search courses and transcripts</span>
              </Link>
              <Link className="portal-notes-link" href="/my-notes">✎ <span>My Notes</span></Link>
            </header>

            {children}
            <TranscriptSync />

            <footer className="footer">
              <div className="container">Classics Courses with Timothy Lowenhaupt</div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  )
}
