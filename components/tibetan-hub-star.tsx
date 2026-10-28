'use client'

import Link from 'next/link'
import TibetanStarButton from '@/components/tibetan-star-button'
import { useTibetanStars } from '@/components/use-tibetan-stars'

export default function TibetanHubStar({ term, slug }: { term: string; slug: string }) {
  const { idSet, ready, toggle } = useTibetanStars()
  const starred = idSet.has(slug)

  return (
    <div className="tibetan-hub-save-actions">
      <TibetanStarButton
        term={term}
        starred={starred}
        disabled={!ready}
        toggle={() => toggle(slug)}
      />
      <span className="tibetan-hub-save-label">{starred ? 'Saved to your terms' : 'Star this term to study later'}</span>
      <Link href="/tibetan/saved">My saved terms</Link>
    </div>
  )
}
