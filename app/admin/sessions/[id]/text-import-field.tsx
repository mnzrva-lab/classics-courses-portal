'use client'

import { ChangeEvent, useRef, useState } from 'react'
import mammoth from 'mammoth'
import { createClient } from '@/lib/supabase/client'

const TRANSCRIPT_ASSETS_BUCKET = 'transcript-assets'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

type Props = {
  name: string
  label: string
  defaultValue?: string | null
  rows: number
  placeholder?: string
  help?: string
  sessionId?: string
  preserveTranscriptImages?: boolean
}

function imageExtension(contentType: string) {
  const known: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  return known[contentType.toLowerCase()] ?? 'bin'
}

function isTranscriptDisclaimer(text: string) {
  return text.startsWith('This transcript was created by a student with AI and should be used for reference only.')
}

function transcriptTextFromHtml(html: string) {
  const document = new DOMParser().parseFromString(`<div id="docx-root">${html}</div>`, 'text/html')
  const root = document.querySelector('#docx-root')
  if (!root) return ''

  const blocks: string[] = []

  for (const element of Array.from(root.children)) {
    const tag = element.tagName.toUpperCase()
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim()

    if (tag === 'H1') continue

    if (tag === 'H2' || tag === 'H3' || tag === 'H4') {
      if (text) blocks.push(`### ${text}`)
      continue
    }

    if (tag === 'P') {
      if (text && !isTranscriptDisclaimer(text)) blocks.push(text)

      for (const image of Array.from(element.querySelectorAll('img'))) {
        const source = image.getAttribute('src') ?? ''
        if (!source.startsWith('transcript-asset:')) continue
        const marker = source.slice('transcript-asset:'.length)
        blocks.push(`[[TRANSCRIPT_IMAGE|${marker}]]`)
      }
      continue
    }

    if (tag === 'UL' || tag === 'OL') {
      for (const item of Array.from(element.querySelectorAll(':scope > li'))) {
        const itemText = (item.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (itemText) blocks.push(itemText)
      }
      continue
    }

    if (text && !isTranscriptDisclaimer(text)) blocks.push(text)
  }

  return blocks.join('\n\n').trim()
}

function sessionIdFromLocation() {
  if (typeof window === 'undefined') return null
  const match = window.location.pathname.match(/\/admin\/sessions\/([^/?#]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export default function TextImportField({
  name,
  label,
  defaultValue = '',
  rows,
  placeholder,
  help,
  sessionId,
  preserveTranscriptImages = false,
}: Props) {
  const [value, setValue] = useState(defaultValue ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [importedFileName, setImportedFileName] = useState('')
  const temporaryUploads = useRef<string[]>([])
  const shouldPreserveTranscriptImages = preserveTranscriptImages || name === 'transcript_content'

  async function removeTemporaryUploads(paths: string[]) {
    if (!paths.length) return
    const supabase = createClient()
    await supabase.storage.from(TRANSCRIPT_ASSETS_BUCKET).remove(paths)
  }

  async function handleTranscriptDocx(file: File) {
    const resolvedSessionId = sessionId ?? sessionIdFromLocation()
    if (!resolvedSessionId) throw new Error('A session is required before transcript images can be imported.')

    const supabase = createClient()
    const uploadedPaths: string[] = []

    try {
      const result = await mammoth.convertToHtml(
        { arrayBuffer: await file.arrayBuffer() },
        {
          styleMap: [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
          ],
          convertImage: mammoth.images.imgElement(async (image) => {
            const bytes = await image.readAsArrayBuffer()
            if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('An embedded transcript image is larger than 20 MB.')

            const extension = imageExtension(image.contentType)
            const storagePath = `transcripts/${resolvedSessionId}/${crypto.randomUUID()}.${extension}`
            const { error } = await supabase.storage
              .from(TRANSCRIPT_ASSETS_BUCKET)
              .upload(storagePath, new Blob([bytes], { type: image.contentType }), {
                cacheControl: '3600',
                contentType: image.contentType,
                upsert: false,
              })

            if (error) throw new Error(`Could not upload an embedded transcript image: ${error.message}`)
            uploadedPaths.push(storagePath)
            return { src: `transcript-asset:${storagePath}|${image.contentType}` }
          }),
        }
      )

      const text = transcriptTextFromHtml(result.value)
      if (!text) throw new Error('No transcript text could be read from this DOCX file.')

      const previousUploads = temporaryUploads.current
      temporaryUploads.current = uploadedPaths
      await removeTemporaryUploads(previousUploads)

      const warnings = result.messages.filter((item) => item.type === 'warning')
      const imageMessage = uploadedPaths.length
        ? ` ${uploadedPaths.length} embedded image${uploadedPaths.length === 1 ? '' : 's'} preserved in source order.`
        : ' No embedded transcript images were found.'
      const warningMessage = warnings.length
        ? ` ${warnings.length} DOCX warning${warnings.length === 1 ? '' : 's'} reported.`
        : ''

      return {
        text,
        message: `Imported ${file.name}.${imageMessage}${warningMessage} Review the transcript before saving.`,
      }
    } catch (error) {
      await removeTemporaryUploads(uploadedPaths)
      throw error
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setReading(true)
    setMessage('Reading file…')

    try {
      const lower = file.name.toLowerCase()
      let text = ''
      let nextMessage = ''

      if (lower.endsWith('.docx')) {
        if (shouldPreserveTranscriptImages) {
          const imported = await handleTranscriptDocx(file)
          text = imported.text
          nextMessage = imported.message
        } else {
          const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
          text = result.value
          const warnings = result.messages.filter((item) => item.type === 'warning')
          nextMessage = warnings.length
            ? `Imported ${file.name}. Review the text before saving; ${warnings.length} DOCX warning${warnings.length === 1 ? '' : 's'} were reported.`
            : `Imported ${file.name}. Review the text before saving.`
        }
      } else if (lower.endsWith('.md') || lower.endsWith('.txt')) {
        if (temporaryUploads.current.length) {
          await removeTemporaryUploads(temporaryUploads.current)
          temporaryUploads.current = []
        }
        text = await file.text()
        nextMessage = `Imported ${file.name}. Review the text before saving.`
      } else {
        throw new Error('Use a .docx, .md, or .txt file.')
      }

      setValue(text.trim())
      setImportedFileName(file.name)
      setMessage(nextMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read this file.')
    } finally {
      setReading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="form-stack">
      {shouldPreserveTranscriptImages ? <input type="hidden" name="transcript_import_file_name" value={importedFileName} /> : null}
      <label>{label}
        <textarea
          className="input"
          name={name}
          rows={rows}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          required
        />
      </label>
      <div>
        <label className="button" style={{ display: 'inline-block', cursor: reading ? 'wait' : 'pointer' }}>
          {reading ? 'Reading file…' : 'Import DOCX / MD / TXT'}
          <input
            type="file"
            accept=".docx,.md,.txt,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFile}
            disabled={reading}
            style={{ display: 'none' }}
          />
        </label>
      </div>
      {help ? <p className="meta">{help}</p> : null}
      {message ? <p className="meta">{message}</p> : null}
    </div>
  )
}
