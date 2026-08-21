'use client'

import Link from 'next/link'
import { useState } from 'react'
import { saveParagraphNote, toggleParagraphBookmark } from './actions'

type Props = {
  paragraphId: string
  sessionId: string
  returnPath: string
  bookmarked: boolean
  canSaveBookmarks: boolean
  canSaveNotes: boolean
  noteCount: number
}

export default function PassageStudyTools({
  paragraphId,
  sessionId,
  returnPath,
  bookmarked,
  canSaveBookmarks,
  canSaveNotes,
  noteCount,
}: Props) {
  const [noteOpen, setNoteOpen] = useState(false)

  return (
    <div className="passage-study-tools">
      {(canSaveBookmarks || bookmarked) ? (
        <form action={toggleParagraphBookmark.bind(null, paragraphId, returnPath)}>
          <button className="passage-action" type="submit">
            {bookmarked ? '★ Bookmarked' : '☆ Bookmark'}
          </button>
        </form>
      ) : null}

      {canSaveNotes ? (
        <div>
          <button
            className={noteOpen ? 'passage-action active' : 'passage-action'}
            type="button"
            onClick={() => setNoteOpen((value) => !value)}
            aria-expanded={noteOpen}
          >
            + Note
          </button>

          {noteOpen ? (
            <form
              className="passage-note-form"
              action={saveParagraphNote.bind(null, paragraphId, sessionId, returnPath)}
            >
              <label>
                <span className="meta">Private note about this exact passage</span>
                <textarea className="input" name="note" rows={3} required autoFocus placeholder="What do you want to remember here?" />
              </label>
              <div className="actions" style={{ marginTop: 8 }}>
                <button className="button sage" type="submit">Save note</button>
                <button className="button" type="button" onClick={() => setNoteOpen(false)}>Cancel</button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {noteCount > 0 ? (
        <Link className="passage-action" href={`/my-notes?passage=${encodeURIComponent(paragraphId)}`}>
          {noteCount} saved note{noteCount === 1 ? '' : 's'}
        </Link>
      ) : null}
    </div>
  )
}
