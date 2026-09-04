'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub as string | undefined
  if (!userId) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  if (profile?.role !== 'admin') throw new Error('Admin access required')
  return supabase
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tibetan-term'
}

function parseDelimited(text: string) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((line) => line.trim())
  if (!lines.length) return [] as string[][]
  const delimiter = lines[0].includes('\t') ? '\t' : ','

  if (delimiter === '\t') return lines.map((line) => line.split('\t').map((cell) => cell.trim()))

  return lines.map((line) => {
    const cells: string[] = []
    let current = ''
    let quoted = false
    for (let index = 0; index < line.length; index++) {
      const char = line[index]
      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          current += '"'
          index++
        } else {
          quoted = !quoted
        }
      } else if (char === ',' && !quoted) {
        cells.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    cells.push(current.trim())
    return cells
  })
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function cleanUrl(value: string | undefined) {
  const text = String(value ?? '').trim()
  if (!text) return null
  try {
    const url = new URL(text)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

export async function bulkImportTibetanTerms(formData: FormData) {
  const supabase = await requireAdmin()
  const raw = String(formData.get('rows') ?? '').trim()
  if (!raw) throw new Error('Paste glossary rows before importing.')

  const rows = parseDelimited(raw)
  if (rows.length < 2) throw new Error('Include a header row and at least one glossary row.')

  const headers = rows[0].map(normalizeHeader)
  const required = ['transliteration', 'english_meaning']
  for (const header of required) {
    if (!headers.includes(header)) throw new Error(`Missing required column: ${header}`)
  }

  const existingResult = await supabase.from('tibetan_terms').select('slug')
  if (existingResult.error) throw new Error(existingResult.error.message)
  const existingSlugs = new Set((existingResult.data ?? []).map((item) => item.slug))

  let created = 0
  let skipped = 0
  let sourceCount = 0
  let invalid = 0

  for (const cells of rows.slice(1)) {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => { record[header] = cells[index] ?? '' })

    const transliteration = String(record.transliteration ?? '').trim()
    const englishMeaning = String(record.english_meaning ?? '').trim()
    if (!transliteration || !englishMeaning) {
      invalid++
      continue
    }

    const slug = slugify(transliteration)
    if (existingSlugs.has(slug)) {
      skipped++
      continue
    }

    const aliasText = String(record.aliases ?? '').trim()
    const aliasList = aliasText
      ? aliasText.split(/[|;]/).map((item) => item.trim()).filter(Boolean)
      : []
    const sortOrder = Number.parseInt(String(record.sort_order ?? '0'), 10)

    const { data: term, error: termError } = await supabase
      .from('tibetan_terms')
      .insert({
        slug,
        transliteration,
        english_meaning: englishMeaning,
        explanation: String(record.explanation ?? '').trim() || null,
        aliases: aliasList,
        status: 'draft',
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
      })
      .select('id')
      .single()

    if (termError || !term) {
      invalid++
      continue
    }

    existingSlugs.add(slug)
    created++

    const sourceLabel = String(record.source_label ?? '').trim() || null
    const sourceUrl = cleanUrl(record.source_url)
    const sourceNote = String(record.source_note ?? '').trim() || null
    if (sourceLabel || sourceUrl) {
      const { error: sourceError } = await supabase.from('tibetan_term_sources').insert({
        term_id: term.id,
        source_label: sourceLabel,
        external_url: sourceUrl,
        note: sourceNote,
      })
      if (!sourceError) sourceCount++
    }
  }

  redirect(`/admin/tibetan/import?created=${created}&skipped=${skipped}&invalid=${invalid}&sources=${sourceCount}`)
}
