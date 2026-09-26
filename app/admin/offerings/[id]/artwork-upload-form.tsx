'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createArtworkUploadUrl, registerArtworkUpload } from './actions'

const BUCKET = 'course-artwork'
const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export default function ArtworkUploadForm({ offeringId }: { offeringId: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (uploading) return
    const form = event.currentTarget
    const file = new FormData(form).get('artwork_file')

    if (!(file instanceof File) || !file.size) return setMessage('Choose an image first.')
    if (!ALLOWED.has(file.type)) return setMessage('Use a JPG, PNG, or WebP image.')
    if (file.size > MAX_BYTES) return setMessage('Artwork images can be up to 10 MB.')

    setUploading(true)
    setMessage('Uploading artwork…')
    try {
      const { storagePath, token } = await createArtworkUploadUrl(offeringId, file.name, file.type)
      const supabase = createClient()
      const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(storagePath, token, file, {
        contentType: file.type,
      })
      if (error) throw error
      await registerArtworkUpload(offeringId, storagePath)
      setMessage('Artwork updated.')
      form.reset()
      window.location.reload()
    } catch (error) {
      setMessage(error instanceof Error ? `Upload failed: ${error.message}` : 'Artwork upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={handleSubmit}>
      <label>Upload artwork
        <input className="input" type="file" name="artwork_file" accept="image/jpeg,image/png,image/webp" required />
      </label>
      <p className="meta">JPG, PNG, or WebP · up to 10 MB. This becomes the public artwork for this Course Offering.</p>
      {message ? <p className="meta" aria-live="polite">{message}</p> : null}
      <div className="actions"><button className="button sage" type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload artwork'}</button></div>
    </form>
  )
}
