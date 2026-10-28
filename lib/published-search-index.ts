import 'server-only'
import { cache } from 'react'
import { readManagedJSON } from '@/lib/public-content'

export type PublishedSearchRecord = {
  id: string
  sourceId: string
  sourceLabel: string
  contextLabel: string
  sessionLabel: string
  sessionKind: string
  teacher: string
  contentType: 'Transcript' | 'Study Notes' | 'Recording' | 'Overview'
  chapter?: string
  speaker?: string
  body: string
  href: string
  reference: string
  glossarySource?: string
}
type SearchIndexManifest = {
  schemaVersion: 1
  revision: string
  recordCount: number
  parts: string[]
}
type SearchPart = { schemaVersion: 1; records: PublishedSearchRecord[] }

const partPattern = /^search\/parts\/part-[a-f0-9]{20}-[0-9]{4}\.json$/
const safe = (value: unknown, max = 25000): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max
const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

function approvedPath(value: unknown): value is string {
  return safe(value, 700) && value.startsWith('/') && !value.startsWith('//') &&
    /^\/(?:archive\/classics\/course-(?:[1-9]|1[0-8])\/[a-z0-9-]+\/[a-z0-9-]+|other-programs\/[a-z0-9-]+)(?:#[a-z0-9-]+)?$/.test(value)
}
function isSearchRecord(value: unknown): value is PublishedSearchRecord {
  if (!isRecord(value)) return false
  const plain = ['id','sourceId','sourceLabel','contextLabel','sessionLabel',
    'sessionKind','body','reference']
  if (!plain.every(key => safe(value[key],key==='body'?25000:800))) return false
  if (!safe(value.teacher,200) && value.teacher !== '') return false
  if (!['Transcript','Study Notes','Recording','Overview'].includes(String(value.contentType))) return false
  if (!approvedPath(value.href)) return false
  if (value.chapter !== undefined && !safe(value.chapter,300)) return false
  if (value.speaker !== undefined && !safe(value.speaker,200)) return false
  if (value.glossarySource !== undefined &&
      (!approvedPath(value.glossarySource) || !String(value.href).startsWith(value.glossarySource+'#'))) return false
  return true
}
function isSearchManifest(value: unknown): value is SearchIndexManifest {
  return isRecord(value) && value.schemaVersion===1 &&
    typeof value.revision==='string' && /^[a-f0-9]{64}$/.test(value.revision) &&
    Number.isInteger(value.recordCount) && (value.recordCount as number)>=0 &&
    (value.recordCount as number)<=300000 &&
    Array.isArray(value.parts) && value.parts.length<=500 &&
    value.parts.every(p => typeof p==='string' && partPattern.test(p)) &&
    new Set(value.parts).size===value.parts.length
}
function isSearchPart(value: unknown): value is SearchPart {
  return isRecord(value) && value.schemaVersion===1 &&
    Array.isArray(value.records) && value.records.length<=800 &&
    value.records.every(isSearchRecord)
}

/** Reads only the generated index. ACI 17 and bundled legacy sources remain separate. */
export const getPublishedSearchRecords = cache(async (): Promise<PublishedSearchRecord[]> => {
  const index = await readManagedJSON('search/manifest.json', isSearchManifest)
  if (!index || !index.parts.length) return []
  const records: PublishedSearchRecord[] = []
  for (let i=0; i<index.parts.length; i+=8) {
    const batch = await Promise.all(index.parts.slice(i,i+8).map(part =>
      readManagedJSON(part,isSearchPart)))
    if (batch.some(part => !part)) return [] // fail closed on incomplete index
    for (const part of batch) if (part) records.push(...part.records)
  }
  // A partial or inconsistent revision must not create dead/missing search links.
  if (records.length!==index.recordCount) return []
  return records
})
