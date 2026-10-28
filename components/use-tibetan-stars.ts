'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const KEY = 'classics-library:tibetan-starred:v1'
const CHANGE = 'classics-library:tibetan-stars-changed'

function readStars(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return Array.from(new Set(parsed.filter((value): value is string =>
      typeof value === 'string' && value.length > 0 && value.length <= 160
    )))
  } catch {
    return []
  }
}

/** Browser-only saved terms. No account sync and no server-side personal data. */
export function useTibetanStars() {
  const [ids, setIds] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    function sync() { setIds(readStars()) }
    function onStorage(event: StorageEvent) {
      if (event.key === KEY || event.key === null) sync()
    }
    sync()
    setReady(true)
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE, sync)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE, sync)
    }
  }, [])

  const toggle = useCallback((id: string) => {
    const next = new Set(readStars())
    if (next.has(id)) next.delete(id)
    else next.add(id)
    const updated = [...next]
    try {
      window.localStorage.setItem(KEY, JSON.stringify(updated))
      window.dispatchEvent(new Event(CHANGE))
    } catch {
      // Keep the current session usable even when browser storage is unavailable.
      setIds(updated)
    }
  }, [])

  return { ids, idSet: useMemo(() => new Set(ids), [ids]), ready, toggle }
}
