'use client'

import Link from 'next/link'
import { useState } from 'react'
import CopyReference from '@/components/copy-reference'
import { saveParagraphNote, toggleParagraphBookmark } from './actions'

type Props = {
  paragraphId: string
  sessionId: string
  returnPath: string
  bookmarked: boolean
  canSaveBookmarks: boolean
  canSaveNotes: boolean
  noteCount: number
  reference: string
  passagePath: string
}

export default function PassageStudyTools({
  paragraphId,
  sessionId,
  returnPath,
  bookmarked,
  canSaveBookmarks,
  canSaveNotes,
  noteCount,
  reference,
  passagePath,
}: Props) {
  const [noteOpen, setNoteOpen] = useState(false)

  return (
    <div className="passage-study-tools">
      {(canSaveBookmarks || bookmarked) ? (
        <form action={toggleParagraphBookmark.bind(null, paragraphId, returnPath)}>
          <button className="passage-action passage-icon" type="submit" title={bookmarked ? 'Remove bookmark' : 'Bookmark passage'} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark passage'}>
            {bookmarked ? '★' : '☆'}
          </button>
        </form>
      ) : null}

      {canSaveNotes ? (
        <div>
          <button
            className={noteOpen ? 'passage-action passage-icon active' : 'passage-action passage-icon'}
            type="button"
            onClick={() => setNoteOpen((value) => !value)}
            aria-expanded={noteOpen}
            title="Add private note"
            aria-label="Add private note"
          >
            ✎
          </button>

          {noteOpen ? (
            <form className="passage-note-form" action={saveParagraphNote.bind(null, paragraphId, sessionId, returnPath)}>
              <label>
                <span className="meta">Private note about this exact passage</span>
                <textarea className="input" name="note" rows={3} required autoFocus placeholder="What do you want to remember here?" />
              </label>
              <div className="meta passage-reference-preview">{reference}</div>
              <div className="actions" style={{ marginTop: 8 }}>
                <button className="button sage" type="submit">Save note</button>
                <button className="button" type="button" onClick={() => setNoteOpen(false)}>Cancel</button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      <CopyReference reference={reference} path={passagePath} />

      {noteCount > 0 ? (
        <Link className="passage-action passage-note-count" href={`/my-notes?passage=${encodeURIComponent(paragraphId)}`} title="Open saved notes">
          {noteCount}
        </Link>
      ) : null}
    </div>
  )
}
