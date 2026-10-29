import rawRecordings from '@/content/classics/course-18-recordings.json'

export type Course18Recording = {
  classNumber: number
  videoId: string
  url: string
}

type Course18RecordingSource = {
  schemaVersion: number
  course: number
  playlistUrl: string
  recordings: Course18Recording[]
}

/** Editor-provided recordings. The schedule remains the source of class dates and times. */
const source = rawRecordings as Course18RecordingSource

export const course18PlaylistUrl = source.playlistUrl

export function course18RecordingFor(classNumber: number): Course18Recording | null {
  return source.recordings.find(recording => recording.classNumber === classNumber) ?? null
}
