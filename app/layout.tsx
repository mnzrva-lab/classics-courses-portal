import type { Metadata } from 'next'
import Link from 'next/link'
import SiteNavigation from '@/components/site-navigation'
import TranscriptSync from '@/components/transcript-sync'
import ClassStudyTabs from '@/components/class-study-tabs'
import rawCourseData from '@/content/classics/course-08/taiwan-2026.json'
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
import './admin-program-artwork.css'
import './program-archive-pass.css'
import './program-artwork.css'
import './student-compact-pass.css'
import './design-tibetan-pass.css'

export const metadata: Metadata = {
  title: 'Classics Courses with Timothy Lowenhaupt',
  description: 'Classics Courses, Living Lam Rim, meditations, transcripts, Study Notes, and study materials.',
}

type CourseData = {
  course: {
    canonicalNumber: number
    title: string
  }
  offering: {
    label: string
  }
}

const courseData = rawCourseData as CourseData
const currentCourse = {
  href: '/courses/course-8/taiwan-2026',
  label: `Classics Course ${courseData.course.canonicalNumber} · ${courseData.offering.label}`,
  title: courseData.course.title,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en"><body><div className="portal-shell">
      <SiteNavigation isAdmin={false} currentCourse={currentCourse} perfectionHref="/perfection-of-wisdom" personalStudyEnabled={false} />
      <div className="portal-main">
        <header className="portal-topbar">
          <Link className="portal-mobile-brand" href="/"><span className="sidebar-mark" aria-hidden="true">C</span><strong>Classics Courses</strong></Link>
          <form className="portal-search-form" action="/search" method="get" role="search"><span aria-hidden="true">⌕</span><input name="q" type="search" aria-label="Search courses, Study Notes and transcripts" placeholder="Search the teaching library" /></form>
        </header>
        {children}
        <ClassStudyTabs />
        <TranscriptSync />
        <footer className="footer portal-footer"><div className="container portal-footer-inner"><span>Classics Courses with Timothy Lowenhaupt</span><a href={TELEGRAM_UPDATES_URL} target="_blank" rel="noreferrer">Telegram updates ↗</a></div></footer>
      </div>
    </div></body></html>
  )
}
