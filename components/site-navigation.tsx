'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

type CurrentCourse = { href: string; label: string; title: string } | null
type Props = {
  isAdmin: boolean
  currentCourse: CurrentCourse
  perfectionHref: string
  personalStudyEnabled?: boolean
}

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  if (href === '/courses') return pathname === '/courses' || pathname.startsWith('/courses/classics-course-') || pathname.startsWith('/courses/course-')
  return pathname === href || pathname.startsWith(`${href}/`)
}

function SidebarLink({ pathname, href, icon, children }: { pathname: string; href: string; icon: string; children: React.ReactNode }) {
  const active = isActivePath(pathname, href)
  return (
    <Link className={active ? 'sidebar-link active' : 'sidebar-link'} href={href} aria-current={active ? 'page' : undefined}>
      <span aria-hidden="true">{icon}</span><span>{children}</span>
    </Link>
  )
}

export default function SiteNavigation({ isAdmin, currentCourse, perfectionHref, personalStudyEnabled = true }: Props) {
  const pathname = usePathname()
  const moreRef = useRef<HTMLDetailsElement | null>(null)

  useEffect(() => {
    moreRef.current?.removeAttribute('open')
  }, [pathname])

  useEffect(() => {
    function closeMore(event: PointerEvent) {
      const details = moreRef.current
      if (!details?.open) return
      if (event.target instanceof Node && !details.contains(event.target)) details.removeAttribute('open')
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') moreRef.current?.removeAttribute('open')
    }

    document.addEventListener('pointerdown', closeMore)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMore)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  useEffect(() => {
    let lastY = window.scrollY

    function updateTopbar() {
      if (window.innerWidth > 960) {
        document.body.classList.remove('portal-topbar-hidden')
        lastY = window.scrollY
        return
      }

      const currentY = window.scrollY
      if (currentY < 48) {
        document.body.classList.remove('portal-topbar-hidden')
      } else if (currentY > lastY + 6 && currentY > 96) {
        document.body.classList.add('portal-topbar-hidden')
      } else if (currentY < lastY - 6) {
        document.body.classList.remove('portal-topbar-hidden')
      }
      lastY = currentY
    }

    updateTopbar()
    window.addEventListener('scroll', updateTopbar, { passive: true })
    window.addEventListener('resize', updateTopbar)
    return () => {
      window.removeEventListener('scroll', updateTopbar)
      window.removeEventListener('resize', updateTopbar)
      document.body.classList.remove('portal-topbar-hidden')
    }
  }, [])

  function closeMore() {
    moreRef.current?.removeAttribute('open')
  }

  return (
    <>
      <aside className="portal-sidebar">
        <Link className="sidebar-brand" href="/"><span className="sidebar-mark" aria-hidden="true">C</span><span className="sidebar-brand-copy"><strong>Classics Courses</strong><small>Study portal</small></span></Link>

        <nav className="sidebar-nav" aria-label="Primary navigation">
          <SidebarLink pathname={pathname} href="/" icon="⌂">Home</SidebarLink>
          <div className="sidebar-label">Courses</div>
          <SidebarLink pathname={pathname} href="/courses" icon="▤">Classics Courses</SidebarLink>
          <SidebarLink pathname={pathname} href="/living-lam-rim" icon="◌">Living Lam Rim</SidebarLink>
          <SidebarLink pathname={pathname} href={perfectionHref} icon="◇">Perfection of Wisdom</SidebarLink>
          <SidebarLink pathname={pathname} href="/other-programs" icon="◫">Other Programs</SidebarLink>

          {currentCourse ? <Link className="sidebar-current-course" href={currentCourse.href}><span>LATEST</span><strong>{currentCourse.label}</strong><small>{currentCourse.title}</small></Link> : null}

          <div className="sidebar-label">Study</div>
          <SidebarLink pathname={pathname} href="/meditations" icon="◎">Meditations</SidebarLink>
          <SidebarLink pathname={pathname} href="/tibetan" icon="T">Tibetan</SidebarLink>
          {personalStudyEnabled ? <SidebarLink pathname={pathname} href="/my-learning" icon="✓">My Learning</SidebarLink> : null}
          {isAdmin ? <SidebarLink pathname={pathname} href="/admin" icon="⚙">Admin</SidebarLink> : null}
        </nav>
      </aside>

      <nav className={personalStudyEnabled ? 'portal-mobile-nav' : 'portal-mobile-nav compact'} aria-label="Mobile navigation">
        <Link className={pathname === '/' ? 'active' : ''} href="/"><span aria-hidden="true">⌂</span><small>Home</small></Link>
        <Link className={isActivePath(pathname, '/courses') ? 'active' : ''} href="/courses"><span aria-hidden="true">▤</span><small>Courses</small></Link>
        <Link className={isActivePath(pathname, '/search') ? 'active' : ''} href="/search"><span aria-hidden="true">⌕</span><small>Search</small></Link>
        {personalStudyEnabled ? <Link className={isActivePath(pathname, '/my-notes') ? 'active' : ''} href="/my-notes"><span aria-hidden="true">✎</span><small>Notes</small></Link> : null}
        <details ref={moreRef} className="portal-mobile-more">
          <summary><span aria-hidden="true">•••</span><small>More</small></summary>
          <div className="portal-mobile-more-panel">
            <Link href="/living-lam-rim" onClick={closeMore}>Living Lam Rim</Link>
            <Link href={perfectionHref} onClick={closeMore}>Perfection of Wisdom</Link>
            <Link href="/other-programs" onClick={closeMore}>Other Programs</Link>
            <Link href="/meditations" onClick={closeMore}>Meditations</Link>
            <Link href="/tibetan" onClick={closeMore}>Tibetan</Link>
            {personalStudyEnabled ? <Link href="/my-learning" onClick={closeMore}>My Learning</Link> : null}
            {isAdmin ? <Link href="/admin" onClick={closeMore}>Admin</Link> : null}
          </div>
        </details>
      </nav>
    </>
  )
}
