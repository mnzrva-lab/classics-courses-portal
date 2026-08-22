'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type CurrentCourse = {
  href: string
  label: string
  title: string
} | null

type Props = {
  isAdmin: boolean
  currentCourse: CurrentCourse
  perfectionHref: string
}

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  if (href === '/courses') return pathname === '/courses' || pathname.startsWith('/courses/classics-course-')
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarLink({ pathname, href, icon, children }: { pathname: string; href: string; icon: string; children: React.ReactNode }) {
  const active = isActivePath(pathname, href)
  return (
    <Link className={active ? 'sidebar-link active' : 'sidebar-link'} href={href} aria-current={active ? 'page' : undefined}>
      <span aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </Link>
  )
}

export default function SiteNavigation({ isAdmin, currentCourse, perfectionHref }: Props) {
  const pathname = usePathname()

  return (
    <>
      <aside className="portal-sidebar">
        <Link className="sidebar-brand" href="/">
          <span className="sidebar-mark" aria-hidden="true">C</span>
          <span className="sidebar-brand-copy">
            <strong>Classics Courses</strong>
            <small>Study portal</small>
          </span>
        </Link>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <SidebarLink pathname={pathname} href="/" icon="⌂">Home</SidebarLink>

          <div className="sidebar-label">Courses</div>
          <SidebarLink pathname={pathname} href="/courses" icon="▤">Classics Courses</SidebarLink>
          <SidebarLink pathname={pathname} href="/living-lam-rim" icon="◌">Living Lam Rim</SidebarLink>
          <SidebarLink pathname={pathname} href={perfectionHref} icon="◇">Perfection of Wisdom</SidebarLink>
          <SidebarLink pathname={pathname} href="/other-programs" icon="＋">Other teachings</SidebarLink>

          {currentCourse ? (
            <Link className="sidebar-current-course" href={currentCourse.href}>
              <span>NOW</span>
              <strong>{currentCourse.label}</strong>
              <small>{currentCourse.title}</small>
            </Link>
          ) : null}

          <div className="sidebar-label">Study</div>
          <SidebarLink pathname={pathname} href="/meditations" icon="◎">Meditations</SidebarLink>
          <SidebarLink pathname={pathname} href="/tibetan" icon="T">Tibetan</SidebarLink>
          <SidebarLink pathname={pathname} href="/my-learning" icon="✓">My Learning</SidebarLink>
          {isAdmin ? <SidebarLink pathname={pathname} href="/admin" icon="⚙">Admin</SidebarLink> : null}
        </nav>
      </aside>

      <nav className="portal-mobile-nav" aria-label="Mobile navigation">
        <Link className={pathname === '/' ? 'active' : ''} href="/"><span aria-hidden="true">⌂</span><small>Home</small></Link>
        <Link className={isActivePath(pathname, '/courses') ? 'active' : ''} href="/courses"><span aria-hidden="true">▤</span><small>Courses</small></Link>
        <Link className={isActivePath(pathname, '/search') ? 'active' : ''} href="/search"><span aria-hidden="true">⌕</span><small>Search</small></Link>
        <Link className={isActivePath(pathname, '/my-notes') ? 'active' : ''} href="/my-notes"><span aria-hidden="true">✎</span><small>Notes</small></Link>
        <details className="portal-mobile-more">
          <summary><span aria-hidden="true">•••</span><small>More</small></summary>
          <div className="portal-mobile-more-panel">
            <Link href="/living-lam-rim">Living Lam Rim</Link>
            <Link href={perfectionHref}>Perfection of Wisdom</Link>
            <Link href="/other-programs">Other teachings</Link>
            <Link href="/meditations">Meditations</Link>
            <Link href="/tibetan">Tibetan</Link>
            <Link href="/my-learning">My Learning</Link>
            {isAdmin ? <Link href="/admin">Admin</Link> : null}
          </div>
        </details>
      </nav>
    </>
  )
}
