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

function escapeMarkdownText(value: string) {
  return value.replace(/\s+/g, ' ')
}

function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeMarkdownText(node.textContent ?? '')
  if (!(node instanceof HTMLElement)) return ''

  const tag = node.tagName.toUpperCase()
  if (tag === 'UL' || tag === 'OL' || tag === 'IMG') return ''

  const content = Array.from(node.childNodes).map(inlineMarkdown).join('').replace(/\s+/g, ' ')
  if (!content.trim()) return ''

  if (tag === 'STRONG' || tag === 'B') return `**${content.trim()}**`
  if (tag === 'EM' || tag === 'I') return `*${content.trim()}*`
  if (tag === 'CODE') return `\`${content.trim()}\``
  if (tag === 'A') {
    const href = node.getAttribute('href')?.trim()
    return href ? `[${content.trim()}](${href})` : content
  }
  if (tag === 'BR') return '\n'
  return content
}

function listToMarkdown(list: Element, depth = 0): string[] {
  const ordered = list.tagName.toUpperCase() === 'OL'
  const rows: string[] = []
  const children = Array.from(list.children).filter((child) => child.tagName.toUpperCase() === 'LI')

  children.forEach((item, index) => {
    const directContent = Array.from(item.childNodes)
      .filter((node) => !(node instanceof HTMLElement && ['UL', 'OL'].includes(node.tagName.toUpperCase())))
      .map(inlineMarkdown)
      .join('')
      .replace(/\s+/g, ' ')
      .trim()

    const prefix = ordered ? `${index + 1}.` : '-'
    if (directContent) rows.push(`${'  '.repeat(depth)}${prefix} ${directContent}`)

    for (const nested of Array.from(item.children).filter((child) => ['UL', 'OL'].includes(child.tagName.toUpperCase()))) {
      rows.push(...listToMarkdown(nested, depth + 1))
    }
  })

  return rows
}

function tableToMarkdown(table: Element) {
  const rows = Array.from(table.querySelectorAll('tr')).map((row) =>
    Array.from(row.querySelectorAll(':scope > th, :scope > td')).map((cell) =>
      Array.from(cell.childNodes).map(inlineMarkdown).join('').replace(/\|/g, '\\|').trim()
    )
  ).filter((row) => row.length)

  if (!rows.length) return ''
  const width = Math.max(...rows.map((row) => row.length))
  const normalized = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill('')])
  const header = normalized[0]
  const body = normalized.slice(1)
  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function studyNotesMarkdownFromHtml(html: string) {
  const document = new DOMParser().parseFromString(`<div id="notes-root">${html}</div>`, 'text/html')
  const root = document.querySelector('#notes-root')
  if (!root) return { markdown: '', imageCount: 0 }

  const blocks: string[] = []
  const imageCount = root.querySelectorAll('img').length

  for (const element of Array.from(root.children)) {
    const tag = element.tagName.toUpperCase()
    const content = Array.from(element.childNodes).map(inlineMarkdown).join('').replace(/\s+/g, ' ').trim()

    if (/^H[1-4]$/.test(tag)) {
      const level = Math.min(4, Math.max(2, Number(tag.slice(1)) + 1))
      if (content) blocks.push(`${'#'.repeat(level)} ${content}`)
      continue
    }

    if (tag === 'P') {
      if (content) blocks.push(content)
      continue
    }

    if (tag === 'UL' || tag === 'OL') {
      const lines = listToMarkdown(element)
      if (lines.length) blocks.push(lines.join('\n'))
      continue
    }

    if (tag === 'BLOCKQUOTE') {
      if (content) blocks.push(content.split('\n').map((line) => `> ${line}`).join('\n'))
      continue
    }

    if (tag === 'TABLE') {
      const table = tableToMarkdown(element)
      if (table) blocks.push(table)
      continue
    }

    if (content) blocks.push(content)
  }

  return { markdown: blocks.join('\n\n').trim(), imageCount }
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

  async function handleStudyNotesDocx(file: File) {
    const result = await mammoth.convertToHtml(
      { arrayBuffer: await file.arrayBuffer() },
      {
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
        ],
      }
    )

    const converted = studyNotesMarkdownFromHtml(result.value)
    if (!converted.markdown) throw new Error('No Study Notes text could be read from this DOCX file.')

    const warnings = result.messages.filter((item) => item.type === 'warning')
    const imageMessage = converted.imageCount
      ? ` ${converted.imageCount} embedded image${converted.imageCount === 1 ? ' was' : 's were'} detected. Images are not inserted into Study Notes yet; add important visuals under Class materials.`
      : ''
    const warningMessage = warnings.length
      ? ` ${warnings.length} DOCX warning${warnings.length === 1 ? '' : 's'} reported.`
      : ''

    return {
      text: converted.markdown,
      message: `Imported ${file.name} with headings, emphasis, lists, links, and simple tables preserved.${imageMessage}${warningMessage} Review the formatting before saving.`,
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
          const imported = await handleStudyNotesDocx(file)
          text = imported.text
          nextMessage = imported.message
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
      if (shouldPreserveTranscriptImages) {
        const sourceInput = document.querySelector<HTMLInputElement>('input[name="transcript_source_file_name"]')
        if (sourceInput && !sourceInput.value.trim()) sourceInput.value = file.name
      }
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
