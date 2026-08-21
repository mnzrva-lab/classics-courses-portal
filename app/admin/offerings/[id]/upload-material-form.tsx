'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { registerOfferingUploadedMaterial } from './actions'

const BUCKET = 'teaching-materials'
const MAX_STANDARD_UPLOAD_BYTES = 6 * 1024 * 1024

const materialTypes = [
  ['reading', 'Reading'],
  ['slides', 'Slides'],
  ['audio', 'Audio'],
  ['video', 'Video'],
  ['document', 'Document'],
  ['link', 'Link'],
  ['other', 'Other'],
]

function safeFileName(name: string) {
  const lastDot = name.lastIndexOf('.')
  const rawStem = lastDot > 0 ? name.slice(0, lastDot) : name
  const rawExtension = lastDot > 0 ? name.slice(lastDot + 1) : ''
  const stem = rawStem
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file'
  const extension = rawExtension.replace(/[^A-Za-z0-9]+/g, '').slice(0, 12)
  return extension ? `${stem}.${extension}` : stem
}

export default function OfferingUploadMaterialForm({ offeringId }: { offeringId: string }) {
  const [message, setMessage] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (uploading) return

    const form = event.currentTarget
    const formData = new FormData(form)
    const file = formData.get('material_file')

    if (!(file instanceof File) || file.size === 0) {
      setMessage('Choose a file to upload.')
      return
    }

    if (file.size > MAX_STANDARD_UPLOAD_BYTES) {
      setMessage('For now, direct uploads are limited to 6 MB. Use the resource-link form below for larger files.')
      return
    }

    setUploading(true)
    setMessage('Uploading…')

    const supabase = createClient()
    const storagePath = `offerings/${offeringId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        contentType: file.type || undefined,
        upsert: false,
      })

    if (uploadError) {
      setUploading(false)
      setMessage(`Upload failed: ${uploadError.message}`)
      return
    }

    const metadata = new FormData()
    metadata.set('material_type', String(formData.get('material_type') ?? 'reading'))
    metadata.set('material_status', String(formData.get('material_status') ?? 'draft'))
    metadata.set('material_title', String(formData.get('material_title') ?? '').trim() || file.name)
    metadata.set('storage_path', storagePath)
    metadata.set('original_name', file.name)
    metadata.set('material_mime_type', file.type || '')

    try {
      await registerOfferingUploadedMaterial(offeringId, metadata)
    } catch (error) {
      await supabase.storage.from(BUCKET).remove([storagePath])
      setUploading(false)
      setMessage(error instanceof Error ? error.message : 'Could not save the uploaded file.')
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
      <p className="meta">Course Offering files are uploaded once and can be shown from the Course Offering and its classes. Direct upload is optimized for files up to 6 MB.</p>
      {message ? <p className="meta">{message}</p> : null}
      <div className="actions"><button className="button sage" type="submit" disabled={uploading}>{uploading ? 'Uploading…' : 'Upload file'}</button></div>
    </form>
  )
}
