import 'server-only'
import rawRecordings from '@/content/classics/course-18-recordings.json'
import { readPublishedJSON } from '@/lib/public-content'

export type Course18Recording = {
  classNumber: number
  videoId: string
  url: string
}

export type Course18RecordingSource = {
  schemaVersion: 1
  course: 18
  playlistUrl: string
  recordings: Course18Recording[]
}

export function isCourse18RecordingSource(value: unknown): value is Course18RecordingSource {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<Course18RecordingSource>
  if (data.schemaVersion !== 1 || data.course !== 18 || typeof data.playlistUrl !== 'string') return false
  try {
    const list = new URL(data.playlistUrl)
    if (list.protocol !== 'https:' ||
      !['www.youtube.com', 'youtube.com'].includes(list.hostname) ||
      list.pathname !== '/playlist' || !list.searchParams.get('list')) return false
  } catch { return false }
  if (!Array.isArray(data.recordings) || data.recordings.length > 10) return false
  const classes = new Set<number>()
  const videos = new Set<string>()
  for (const recording of data.recordings as unknown[]) {
    if (!recording || typeof recording !== 'object') return false
    const item = recording as Partial<Course18Recording>
    if (!Number.isInteger(item.classNumber) || item.classNumber! < 1 ||
      item.classNumber! > 10 || classes.has(item.classNumber!)) return false
    if (typeof item.videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(item.videoId) ||
      videos.has(item.videoId)) return false
    if (typeof item.url !== 'string') return false
    try {
      const url = new URL(item.url)
      const isShort = url.hostname === 'youtu.be' && url.pathname === '/' + item.videoId
      const isLong = ['www.youtube.com', 'youtube.com'].includes(url.hostname) &&
        url.pathname === '/watch' && url.searchParams.get('v') === item.videoId
      if (url.protocol !== 'https:' || (!isShort && !isLong)) return false
    } catch { return false }
    classes.add(item.classNumber!)
    videos.add(item.videoId)
  }
  return true
}

const fallback = rawRecordings as Course18RecordingSource

/** A published update takes effect without a website deployment. The local copy
 * keeps existing recordings visible if the private source is temporarily unavailable. */
export async function getCourse18Recordings(): Promise<Course18RecordingSource> {
  return (await readPublishedJSON('classics/course-18/recordings.json', isCourse18RecordingSource)) ?? fallback
}

export function course18RecordingFor(source: Course18RecordingSource, classNumber: number): Course18Recording | null {
  return source.recordings.find(recording => recording.classNumber === classNumber) ?? null
}
