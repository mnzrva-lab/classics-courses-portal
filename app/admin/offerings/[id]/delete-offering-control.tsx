'use client'

import { useRef } from 'react'
import { deleteUnusedOffering } from './actions'

export default function DeleteOfferingControl({
  offeringId,
  label,
  status,
}: {
  offeringId: string
  label: string
  status: string
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const published = status === 'published'

  return (
    <div className="note">
      <div className="eyebrow">Cleanup</div>
      <strong>Delete unused Course Offering</strong>
      <p className="meta" style={{ marginTop: 6 }}>
        For duplicate or failed imports only. Student activity and linked study-library content are protected automatically.
      </p>
      {published ? (
        <p className="meta">Set this offering to Draft or Archived before permanent deletion.</p>
      ) : (
        <button className="button" type="button" onClick={() => dialogRef.current?.showModal()}>Delete unused offering</button>
      )}

      <dialog className="schedule-dialog" ref={dialogRef}>
        <div className="schedule-dialog-shell">
          <div className="schedule-dialog-head">
            <div>
              <div className="eyebrow">Permanent deletion</div>
              <h2>Delete {label}?</h2>
            </div>
            <button className="schedule-dialog-close" type="button" onClick={() => dialogRef.current?.close()} aria-label="Close">×</button>
          </div>

          <div className="form-stack">
            <p>This removes this Course Offering and its sessions, materials, transcripts, and transcript revision history.</p>
            <p className="meta">Deletion is blocked if students have notes, progress, bookmarks, or if the offering is linked from the meditation or Tibetan study library. Uploaded files and artwork must be removed first so Storage is not orphaned.</p>
            <form action={deleteUnusedOffering.bind(null, offeringId)} className="form-stack" onSubmit={() => dialogRef.current?.close()}>
              <label>
                Type DELETE to confirm
                <input className="input" name="confirm_delete" autoComplete="off" pattern="DELETE" required />
              </label>
              <div className="actions">
                <button className="button red" type="submit">Delete permanently</button>
                <button className="button" type="button" onClick={() => dialogRef.current?.close()}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </dialog>
    </div>
  )
}
