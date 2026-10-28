'use client'

export type TranscriptReaderSize = 'small' | 'medium' | 'large'

type Props = {
  size: TranscriptReaderSize
  onSizeChange: (size: TranscriptReaderSize) => void
  hasTimes: boolean
  showTimes: boolean
  onToggleTimes: () => void
}

/** The approved ACI 17 controls, shared across all transcript readers. */
export default function TranscriptReaderToolbar({
  size, onSizeChange, hasTimes, showTimes, onToggleTimes,
}: Props) {
  return (
    <div className="timed-reader-toolbar" aria-label="Transcript reading settings">
      <div className="timed-reader-size">
        <span className="timed-reader-label">Text</span>
        <div className="timed-reader-segment" role="group" aria-label="Transcript text size">
          <button type="button" className={size === 'small' ? 'active' : ''} onClick={() => onSizeChange('small')} aria-pressed={size === 'small'} aria-label="Smaller transcript text">A−</button>
          <button type="button" className={size === 'medium' ? 'active' : ''} onClick={() => onSizeChange('medium')} aria-pressed={size === 'medium'} aria-label="Default transcript text">A</button>
          <button type="button" className={size === 'large' ? 'active' : ''} onClick={() => onSizeChange('large')} aria-pressed={size === 'large'} aria-label="Larger transcript text">A+</button>
        </div>
      </div>
      {hasTimes ? (
        <button
          type="button"
          className={showTimes ? 'timed-reader-times active' : 'timed-reader-times'}
          onClick={onToggleTimes}
          aria-pressed={showTimes}
        >
          {showTimes ? 'Hide paragraph times' : 'Show paragraph times'}
        </button>
      ) : null}
    </div>
  )
}
