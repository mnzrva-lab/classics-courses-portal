import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import TranscriptSync from '@/components/transcript-sync'
import './globals.css'

export const metadata: Metadata = {
  title: 'Classics Courses with Timothy Lowenhaupt',
  description: 'Classics Courses, Living Lam Rim, meditations, and study materials.',
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let isAdmin = false

  try {
    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const userId = claimsData?.claims?.sub as string | undefined
    if (userId) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
      isAdmin = profile?.role === 'admin'
    }
  } catch {
    isAdmin = false
  }

  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <header className="topbar">
            <div className="topbar-inner">
              <Link className="brand" href="/">
                <span className="brand-mark" aria-hidden="true">C</span>
                <span className="brand-copy">Classics Courses</span>
              </Link>

              <nav className="nav desktop-nav" aria-label="Primary navigation">
                <Link href="/">Home</Link>
                <Link href="/courses">Courses</Link>
                <Link href="/search">Search</Link>
                <Link href="/my-notes">My Notes</Link>
              </nav>

              <details className="desktop-more">
                <summary>More</summary>
                <nav className="desktop-more-panel" aria-label="More navigation">
                  <Link href="/living-lam-rim">Living Lam Rim</Link>
                  <Link href="/other-programs">Other Programs</Link>
                  <Link href="/tibetan">Tibetan</Link>
                  <Link href="/meditations">Meditations</Link>
                  <Link href="/my-learning">My Learning</Link>
                  {isAdmin ? <Link href="/admin">Admin</Link> : null}
                </nav>
              </details>

              <div className="mobile-nav-wrap">
                <nav className="mobile-primary" aria-label="Mobile primary navigation">
                  <Link href="/">Home</Link>
                  <Link href="/courses">Courses</Link>
                  <Link href="/search">Search</Link>
                  <Link href="/my-notes">My Notes</Link>
                </nav>
                <details className="mobile-more">
                  <summary>More</summary>
                  <nav aria-label="More navigation">
                    <Link href="/living-lam-rim">Living Lam Rim</Link>
                    <Link href="/other-programs">Other Programs</Link>
                    <Link href="/tibetan">Tibetan</Link>
                    <Link href="/meditations">Meditations</Link>
                    <Link href="/my-learning">My Learning</Link>
                    {isAdmin ? <Link href="/admin">Admin</Link> : null}
                  </nav>
                </details>
              </div>
            </div>
          </header>
          {children}
          <TranscriptSync />
          <footer className="footer">
            <div className="container">Classics Courses with Timothy Lowenhaupt</div>
          </footer>
        </div>
      </body>
    </html>
  )
}
