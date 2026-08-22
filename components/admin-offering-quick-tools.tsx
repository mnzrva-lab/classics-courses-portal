'use client'

import { usePathname } from 'next/navigation'
import ArtworkUploadForm from '@/app/admin/offerings/[id]/artwork-upload-form'
import PlaylistCsvImport from '@/app/admin/offerings/[id]/playlist-csv-import'

export default function AdminOfferingQuickTools() {
  const pathname = usePathname()
  const match = pathname.match(/^\/admin\/offerings\/([^/]+)$/)
  if (!match) return null
  const offeringId = match[1]

  return (
    <aside className="admin-offering-quick-tools admin-offering-tools-grid">
      <div className="admin-offering-tool">
        <div>
          <div className="eyebrow">Course artwork</div>
          <strong>Visual identity</strong>
          <p className="meta">Upload or replace the artwork used by this Course Offering.</p>
        </div>
        <ArtworkUploadForm offeringId={offeringId} />
      </div>

      <div className="admin-offering-tool">
        <div>
          <div className="eyebrow">Recordings</div>
          <strong>YouTube playlist import</strong>
          <p className="meta">Import the playlist once and map each video directly to its class Recording URL.</p>
        </div>
        <PlaylistCsvImport offeringId={offeringId} />
      </div>
    </aside>
  )
}
