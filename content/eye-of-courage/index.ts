import class1Notes from './class-1-notes.json'
import class2Notes from './class-2-notes.json'
import { eyeOfCourageTranscripts } from './transcripts'

export type EyeOfCourageStudyNotes = {
  summary: string
  topics: string[]
  markdown: string
}

export { eyeOfCourageProgram, eyeOfCourageSessions, eyeOfCourageSession } from './program'
export { eyeOfCourageTranscripts }
export type { EyeOfCourageTranscriptParagraph, EyeOfCourageTranscriptChapter } from './transcripts'

export const eyeOfCourageStudyNotes: Record<string, EyeOfCourageStudyNotes> = {
  'class-1': class1Notes,
  'class-2': class2Notes,
}
