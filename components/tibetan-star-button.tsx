'use client'

type Props = {
  term: string
  starred: boolean
  disabled?: boolean
  toggle: () => void
  className?: string
}

export default function TibetanStarButton({ term, starred, disabled = false, toggle, className = '' }: Props) {
  return (
    <button
      type="button"
      className={'tibetan-star-button ' + (starred ? 'is-starred ' : '') + className}
      aria-label={(starred ? 'Remove ' : 'Save ') + term + (starred ? ' from saved Tibetan terms' : ' to saved Tibetan terms')}
      title={starred ? 'Remove from saved terms' : 'Save term'}
      aria-pressed={starred}
      onClick={toggle}
      disabled={disabled}
    >
      <span aria-hidden="true">{starred ? '★' : '☆'}</span>
    </button>
  )
}
