'use server'

import { revalidatePath } from 'next/cache'
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

function requiredText(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`${label} is required`)
  return text
}

function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function validStatus(value: FormDataEntryValue | null) {
  const status = String(value ?? 'draft')
  if (!['draft', 'published', 'archived'].includes(status)) throw new Error('Invalid status')
  return status
}

function integerValue(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return 0
  const number = Number(text)
  if (!Number.isInteger(number)) throw new Error('Sort order must be a whole number')
  return number
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'tibetan-term'
}

function aliases(value: FormDataEntryValue | null) {
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function suggestedMeaning(body: string, bracketIndex: number) {
  const before = body.slice(Math.max(0, bracketIndex - 120), bracketIndex)
  const phrase = before
    .split(/[.!?\n:;]/)
    .pop()
    ?.replace(/[()“”"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() ?? ''
  const words = phrase.split(' ').filter(Boolean).slice(-8).join(' ')
  return words ? `Review meaning: ${words}` : 'Review meaning: add English meaning'
}

function detectedTransliterations(body: string) {
  const matches: Array<{ transliteration: string; index: number }> = []
  const pattern = /\[([A-Z][A-Z0-9' .-]{1,70})\]/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(body)) !== null) {
    const transliteration = match[1].replace(/\s+/g, ' ').trim()
    const letters = transliteration.replace(/[^A-Za-z]/g, '')
    if (letters.length < 2) continue
    if (letters !== letters.toUpperCase()) continue
    matches.push({ transliteration, index: match.index })
  }
  return matches
}

export async function createTibetanTerm(formData: FormData) {
  const supabase = await requireAdmin()
  const transliteration = requiredText(formData.get('transliteration'), 'Transliteration')
  const baseSlug = slugify(transliteration)
  let slug = baseSlug
  let suffix = 2

  while (true) {
    const { data: existing, error } = await supabase.from('tibetan_terms').select('id').eq('slug', slug).maybeSingle()
    if (error) throw new Error(error.message)
    if (!existing) break
    slug = `${baseSlug}-${suffix++}`
  }

  const { error } = await supabase.from('tibetan_terms').insert({
    slug,
    transliteration,
    english_meaning: requiredText(formData.get('english_meaning'), 'English meaning'),
    explanation: optionalText(formData.get('explanation')),
    aliases: aliases(formData.get('aliases')),
    status: validStatus(formData.get('status')),
    sort_order: integerValue(formData.get('sort_order')),
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/tibetan')
  revalidatePath('/tibetan')
  redirect('/admin/tibetan?created=term')
}

export async function updateTibetanTerm(termId: string, termSlug: string, formData: FormData) {
  const supabase = await requireAdmin()
  const englishMeaning = requiredText(formData.get('english_meaning'), 'English meaning')
  const status = validStatus(formData.get('status'))
  if (status === 'published' && englishMeaning.toLowerCase().startsWith('review meaning:')) {
    throw new Error('Review the English meaning before publishing this detected term.')
  }

  const { error } = await supabase
    .from('tibetan_terms')
    .update({
      transliteration: requiredText(formData.get('transliteration'), 'Transliteration'),
      english_meaning: englishMeaning,
      explanation: optionalText(formData.get('explanation')),
      aliases: aliases(formData.get('aliases')),
      status,
      sort_order: integerValue(formData.get('sort_order')),
      updated_at: new Date().toISOString(),
    })
    .eq('id', termId)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/tibetan')
  revalidatePath('/tibetan')
  revalidatePath(`/tibetan/${termSlug}`)
  redirect('/admin/tibetan?saved=term')
}

export async function bulkUpdateTibetanTerms(formData: FormData) {
  const supabase = await requireAdmin()
  const status = validStatus(formData.get('status'))
  const ids = String(formData.get('term_ids') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (!ids.length) throw new Error('Select at least one glossary term.')

  if (status === 'published') {
    const { data: selectedTerms, error: selectedError } = await supabase
      .from('tibetan_terms')
      .select('id, english_meaning')
      .in('id', ids)
    if (selectedError) throw new Error(selectedError.message)
    const unreviewed = (selectedTerms ?? []).filter((term) => String(term.english_meaning ?? '').toLowerCase().startsWith('review meaning:'))
    if (unreviewed.length) throw new Error(`Review the English meaning for ${unreviewed.length} detected term${unreviewed.length === 1 ? '' : 's'} before publishing.`)
  }

  const { error } = await supabase
    .from('tibetan_terms')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/tibetan')
  revalidatePath('/tibetan')
  redirect(`/admin/tibetan?bulk=${status}&count=${ids.length}`)
}

export async function extractTibetanTermsFromSession(formData: FormData) {
  const supabase = await requireAdmin()
  const sessionId = requiredText(formData.get('session_id'), 'Source class')

  const [{ data: session, error: sessionError }, { data: transcript, error: transcriptError }] = await Promise.all([
    supabase.from('sessions').select('id, code, title').eq('id', sessionId).single(),
    supabase.from('transcripts').select('id, title').eq('session_id', sessionId).limit(1).maybeSingle(),
  ])
  if (sessionError) throw new Error(sessionError.message)
  if (transcriptError) throw new Error(transcriptError.message)
  if (!transcript) throw new Error('No transcript exists for this class yet.')

  const { data: paragraphs, error: paragraphsError } = await supabase
    .from('transcript_paragraphs')
    .select('id, body, sort_order')
    .eq('transcript_id', transcript.id)
    .eq('is_active', true)
    .order('sort_order')
  if (paragraphsError) throw new Error(paragraphsError.message)

  const existingResult = await supabase.from('tibetan_terms').select('id, slug, transliteration, aliases')
  if (existingResult.error) throw new Error(existingResult.error.message)
  const byForm = new Map<string, string>()
  for (const term of existingResult.data ?? []) {
    byForm.set(term.slug, term.id)
    byForm.set(slugify(term.transliteration), term.id)
    for (const alias of term.aliases ?? []) byForm.set(slugify(alias), term.id)
  }

  let created = 0
  let linked = 0
  const seenInRun = new Set<string>()

  for (const paragraph of paragraphs ?? []) {
    for (const match of detectedTransliterations(paragraph.body ?? '')) {
      const slug = slugify(match.transliteration)
      const runKey = `${slug}:${paragraph.id}`
      if (seenInRun.has(runKey)) continue
      seenInRun.add(runKey)

      let termId = byForm.get(slug)
      if (!termId) {
        const { data: createdTerm, error: createError } = await supabase
          .from('tibetan_terms')
          .insert({
            slug,
            transliteration: match.transliteration,
            english_meaning: suggestedMeaning(paragraph.body ?? '', match.index),
            explanation: null,
            aliases: [],
            status: 'draft',
            sort_order: 0,
          })
          .select('id')
          .single()
        if (createError || !createdTerm) continue
        termId = createdTerm.id
        byForm.set(slug, termId)
        created++
      }

      const { data: existingSource } = await supabase
        .from('tibetan_term_sources')
        .select('id')
        .eq('term_id', termId)
        .eq('paragraph_id', paragraph.id)
        .maybeSingle()
      if (existingSource) continue

      const { error: sourceError } = await supabase.from('tibetan_term_sources').insert({
        term_id: termId,
        session_id: sessionId,
        paragraph_id: paragraph.id,
        source_label: [session?.code, session?.title].filter(Boolean).join(' · ') || transcript.title || 'Transcript',
        note: 'Detected automatically from an uppercase bracketed transliteration in the transcript. Review before publishing.',
        sort_order: paragraph.sort_order ?? 0,
      })
      if (!sourceError) linked++
    }
  }

  revalidatePath('/admin/tibetan')
  revalidatePath('/tibetan')
  redirect(`/admin/tibetan?detected=${created}&linked=${linked}`)
}

export async function addTibetanSource(termId: string, termSlug: string, formData: FormData) {
  const supabase = await requireAdmin()
  const sourceLabel = optionalText(formData.get('source_label'))
  const externalUrl = optionalText(formData.get('external_url'))
  const sessionId = optionalText(formData.get('session_id'))

  if (!sourceLabel && !externalUrl && !sessionId) {
    throw new Error('Add a source session, source label, or external URL.')
  }

  const { error } = await supabase.from('tibetan_term_sources').insert({
    term_id: termId,
    session_id: sessionId,
    source_label: sourceLabel,
    external_url: externalUrl,
    note: optionalText(formData.get('note')),
    sort_order: integerValue(formData.get('sort_order')),
  })

  if (error) throw new Error(error.message)
  revalidatePath('/admin/tibetan')
  revalidatePath(`/tibetan/${termSlug}`)
  redirect('/admin/tibetan?created=source')
}

export async function deleteTibetanSource(sourceId: string, termSlug: string) {
  const supabase = await requireAdmin()
  const { error } = await supabase.from('tibetan_term_sources').delete().eq('id', sourceId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/tibetan')
  revalidatePath(`/tibetan/${termSlug}`)
  redirect('/admin/tibetan?saved=source-deleted')
}
