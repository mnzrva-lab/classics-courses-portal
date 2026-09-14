import class3StudyNotes from './class-3/study-notes.json'
import {
  meditation2StudyNotesMarkdown,
  meditation2StudyNotesSummary,
  meditation2StudyNotesTopics,
} from './meditation-2/study-notes'

export type Course8StudyNotes = {
  summary: string
  topics: string[]
  markdown: string
}

export const course8StudyNotes: Record<string, Course8StudyNotes> = {
  class3: class3StudyNotes,
  med2: {
    summary: meditation2StudyNotesSummary,
    topics: meditation2StudyNotesTopics,
    markdown: meditation2StudyNotesMarkdown,
  },
}

export function course8StudyNotesForSession(sessionId: string) {
  return course8StudyNotes[sessionId] ?? null
}
