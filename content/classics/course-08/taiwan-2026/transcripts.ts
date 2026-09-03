import class1Part1 from './class-1/transcript-part-1.json'
import class1Part2 from './class-1/transcript-part-2.json'
import class1Part3 from './class-1/transcript-part-3.json'
import class1Part4 from './class-1/transcript-part-4.json'
import class1Part5 from './class-1/transcript-part-5.json'
import med2Part1 from './meditation-2/transcript-part-1.json'
import med2Part2 from './meditation-2/transcript-part-2.json'
import med2Part3 from './meditation-2/transcript-part-3.json'

export type Course8TranscriptParagraph = {
  id: string
  speaker: string
  text: string
  startSeconds?: number | null
}

export type Course8TranscriptChapter = {
  id: string
  title: string
  paragraphs: Course8TranscriptParagraph[]
}

export const course8Transcripts: Record<string, Course8TranscriptChapter[]> = {
  class1: [
    ...class1Part1.chapters,
    ...class1Part2.chapters,
    ...class1Part3.chapters,
    ...class1Part4.chapters,
    ...class1Part5.chapters,
  ],
  med2: [
    ...med2Part1.chapters,
    ...med2Part2.chapters,
    ...med2Part3.chapters,
  ],
}

export function course8TranscriptForSession(sessionId: string) {
  return course8Transcripts[sessionId] ?? []
}
