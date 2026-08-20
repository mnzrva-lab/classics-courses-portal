import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
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
            <Link className="brand" href="/">Classics Courses</Link>
            <nav className="nav" aria-label="Primary navigation">
              <Link href="/">Home</Link>
              <Link href="/courses">Courses</Link>
              <Link href="/living-lam-rim">Living Lam Rim</Link>
              <Link href="/meditations">Meditations</Link>
              <Link href="/search">Search</Link>
              <Link href="/my-learning">My Learning</Link>
              <Link href="/my-notes">My Notes</Link>
              {isAdmin ? <Link href="/admin">Admin</Link> : null}
            </nav>
          </header>
          {children}
          <footer className="footer">
            <div className="container">Classics Courses with Timothy Lowenhaupt</div>
          </footer>
        </div>
      </body>
    </html>
  )
}
