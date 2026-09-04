'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registerUploadedMaterial } from './actions'
import { createSessionMaterialUploadUrl } from './upload-actions'

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

export default function UploadMaterialForm({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (uploading) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const files = formData.getAll('material_files').filter((value): value is File => value instanceof File && value.size > 0)
    if (!files.length) return setMessage('Choose one or more files to upload.')
    const tooLarge = files.find((file) => file.size > MAX_UPLOAD_BYTES)
    if (tooLarge) return setMessage(`${tooLarge.name} is larger than 50 MB. Use a stable external link for larger media.`)

    const materialType = String(formData.get('material_type') ?? 'reading')
    const materialStatus = String(formData.get('material_status') ?? 'published')
    setUploading(true)

    try {
      const supabase = createClient()
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]
        setMessage(`Uploading ${index + 1} of ${files.length}: ${file.name}`)
        const { storagePath, token } = await createSessionMaterialUploadUrl(sessionId, file.name)
        const { error: uploadError } = await supabase.storage.from(BUCKET).uploadToSignedUrl(storagePath, token, file, { contentType: file.type || undefined })
        if (uploadError) throw uploadError

        const metadata = new FormData()
        metadata.set('material_type', materialType)
        metadata.set('material_status', materialStatus)
        metadata.set('material_title', file.name.replace(/\.[^.]+$/, ''))
        metadata.set('storage_path', storagePath)
        metadata.set('original_name', file.name)
        metadata.set('material_mime_type', file.type || '')
        await registerUploadedMaterial(sessionId, metadata)
      }

      form.reset()
      setMessage(`${files.length} file${files.length === 1 ? '' : 's'} uploaded as ${materialStatus}.`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? `Upload failed: ${error.message}` : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form className="form-stack compact-bulk-upload" onSubmit={handleSubmit}>
      <div className="grid two">
        <label>Type for all files
          <select className="input" name="material_type" defaultValue="reading">
            {materialTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Status for all files
          <select className="input" name="material_status" defaultValue="published">
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </div>
      <label>Files<input className="input" type="file" name="material_files" multiple required /></label>
      <p className="meta">Select several PDFs, slides, audio files, or documents at once. File names become the resource titles and can be edited afterward. Maximum 50 MB per file.</p>
      {message ? <p className="meta" aria-live="polite">{message}</p> : null}
      <div className="actions"><button className="button sage" type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload selected files'}</button></div>
    </form>
  )
}
