'use client'

import { usePathname } from 'next/navigation'
import ArtworkUploadForm from '@/app/admin/offerings/[id]/artwork-upload-form'

export default function AdminOfferingQuickTools() {
  const pathname = usePathname()
  const match = pathname.match(/^\/admin\/offerings\/([^/]+)$/)
  if (!match) return null

  return (
    <aside className="admin-offering-quick-tools">
      <div>
        <div className="eyebrow">Course artwork</div>
        <strong>Upload the visual identity for this Course Offering</strong>
        <p className="meta">This replaces the public artwork without requiring an external image URL.</p>
      </div>
      <ArtworkUploadForm offeringId={match[1]} />
    </aside>
  )
}
