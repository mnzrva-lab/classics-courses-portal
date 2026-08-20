'use client'

import { ChangeEvent, useState } from 'react'
import mammoth from 'mammoth'

type Props = {
  name: string
  label: string
  defaultValue?: string | null
  rows: number
  placeholder?: string
  help?: string
}

export default function TextImportField({ name, label, defaultValue = '', rows, placeholder, help }: Props) {
  const [value, setValue] = useState(defaultValue ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [reading, setReading] = useState(false)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setReading(true)
    setMessage('Reading file…')

    try {
      const lower = file.name.toLowerCase()
      let text = ''

      if (lower.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
        text = result.value
        const warnings = result.messages.filter((item) => item.type === 'warning')
        setMessage(warnings.length ? `Imported ${file.name}. Review the text before saving; ${warnings.length} DOCX warning${warnings.length === 1 ? '' : 's'} were reported.` : `Imported ${file.name}. Review the text before saving.`)
      } else if (lower.endsWith('.md') || lower.endsWith('.txt')) {
        text = await file.text()
        setMessage(`Imported ${file.name}. Review the text before saving.`)
      } else {
        throw new Error('Use a .docx, .md, or .txt file.')
      }

      setValue(text.trim())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read this file.')
    } finally {
      setReading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="form-stack">
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
