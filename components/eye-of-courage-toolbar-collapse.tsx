'use client'

import { useEffect } from 'react'

export default function EyeOfCourageToolbarCollapse() {
  useEffect(() => {
    const toolbar = document.querySelector<HTMLElement>('.eoc-workshop-toolbar')
    if (!toolbar) return

    toolbar.id = 'workbook-downloads'

    let returnLink = toolbar.querySelector<HTMLAnchorElement>('.eoc-toolbar-return')
    if (!returnLink) {
      returnLink = document.createElement('a')
      returnLink.className = 'button eoc-toolbar-return'
      returnLink.href = '#workbook-downloads'
      returnLink.textContent = 'Back to downloads'
      returnLink.setAttribute('aria-label', 'Return to workbook download controls')
      toolbar.appendChild(returnLink)
    }

    const origin = toolbar.offsetTop
    const update = () => {
      const compact = window.scrollY > origin + 110
      toolbar.classList.toggle('is-compact', compact)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      toolbar.classList.remove('is-compact')
      returnLink?.remove()
    }
  }, [])

  return null
}
