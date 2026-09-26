'use client'

import { useEffect, useState } from 'react'

type Props = {
  reference: string
  path: string
}

function fallbackCopy(value: string) {
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('Copy failed')
}

async function copy(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  fallbackCopy(value)
}

export default function CopyReference({ reference, path }: Props) {
  const [status, setStatus] = useState<'reference' | 'link' | 'citation' | null>(null)

  useEffect(() => {
    if (!status) return
    const timer = window.setTimeout(() => setStatus(null), 1800)
    return () => window.clearTimeout(timer)
  }, [status])

  function absoluteUrl() {
    return new URL(path, window.location.origin).toString()
  }

  async function copyReference() {
    await copy(reference)
    setStatus('reference')
  }
  async function copyLink() {
    await copy(absoluteUrl())
    setStatus('link')
  }
  async function copyCitation() {
    await copy(`${reference}\n${absoluteUrl()}`)
    setStatus('citation')
  }

  return (
    <details className="citation-menu">
      <summary className="passage-action">Cite</summary>
      <div className="citation-menu-panel">
        <button type="button" onClick={copyReference}>{status === 'reference' ? 'Copied' : 'Reference'}</button>
        <button type="button" onClick={copyLink}>{status === 'link' ? 'Copied' : 'Link'}</button>
        <button type="button" onClick={copyCitation}>{status === 'citation' ? 'Copied' : 'Citation + link'}</button>
      </div>
      <span className="sr-only" aria-live="polite">
        {status === 'reference' ? 'Passage reference copied.' : status === 'link' ? 'Passage link copied.' : status === 'citation' ? 'Passage citation copied.' : ''}
      </span>
    </details>
  )
}
