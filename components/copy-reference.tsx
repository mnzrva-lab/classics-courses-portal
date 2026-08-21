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
    <div className="copy-reference" aria-label="Passage reference tools">
      <button className="passage-action" type="button" onClick={copyReference}>
        {status === 'reference' ? 'Reference copied' : 'Copy reference'}
      </button>
      <button className="passage-action" type="button" onClick={copyLink}>
        {status === 'link' ? 'Link copied' : 'Copy link'}
      </button>
      <button className="passage-action" type="button" onClick={copyCitation}>
        {status === 'citation' ? 'Citation copied' : 'Copy citation'}
      </button>
      <span className="sr-only" aria-live="polite">
        {status === 'reference' ? 'Passage reference copied.' : status === 'link' ? 'Passage link copied.' : status === 'citation' ? 'Passage citation copied.' : ''}
      </span>
    </div>
  )
}
