'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createOfferingMaterialUploadUrl, registerOfferingUploadedMaterial } from './material-actions'

const BUCKET = 'teaching-materials'
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

const materialTypes = [
  ['reading', 'Reading'],
  ['slides', 'Slides'],
  ['audio', 'Audio'],
  ['video', 'Video'],
  ['document', 'Document'],
  ['link', 'Link'],
  ['other', 'Other'],
]

export default function OfferingUploadMaterialForm({ offeringId }: { offeringId: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (uploading) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const file = formData.get('material_file')

    if (!(file instanceof File) || file.size === 0) return setMessage('Choose a file to upload.')
    if (file.size > MAX_UPLOAD_BYTES) return setMessage('This storage area accepts files up to 50 MB. Use a stable external link for larger media.')

    setUploading(true)
    setMessage('Preparing secure upload…')

    try {
      const { storagePath, token } = await createOfferingMaterialUploadUrl(offeringId, file.name)
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage.from(BUCKET).uploadToSignedUrl(storagePath, token, file, {
        contentType: file.type || undefined,
      })
      if (uploadError) throw uploadError

      setMessage('Saving material…')
      const metadata = new FormData()
      metadata.set('material_type', String(formData.get('material_type') ?? 'reading'))
      metadata.set('material_status', String(formData.get('material_status') ?? 'draft'))
      metadata.set('material_title', String(formData.get('material_title') ?? '').trim() || file.name)
      metadata.set('storage_path', storagePath)
      metadata.set('original_name', file.name)
      metadata.set('material_mime_type', file.type || '')
      await registerOfferingUploadedMaterial(offeringId, metadata)
    } catch (error) {
      setUploading(false)
      setMessage(error instanceof Error ? `Upload failed: ${error.message}` : 'Upload failed.')
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <div className="grid two">
        <label>Type
          <select className="input" name="material_type" defaultValue="reading">
            {materialTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Status
          <select className="input" name="material_status" defaultValue="draft">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
      </div>
      <label>Title<input className="input" name="material_title" placeholder="Optional. File name is used if blank." /></label>
      <label>File<input className="input" type="file" name="material_file" required /></label>
      <p className="meta">Upload once for the whole Course Offering. Published files remain private in Storage and are delivered to students through signed links. Maximum 50 MB.</p>
      {message ? <p className="meta" aria-live="polite">{message}</p> : null}
      <div className="actions"><button className="button sage" type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload file'}</button></div>
    </form>
  )
}
