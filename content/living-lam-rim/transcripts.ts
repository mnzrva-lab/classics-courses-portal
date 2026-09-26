import part1 from './term-1/class-1/transcript-part-1.json'
import part2 from './term-1/class-1/transcript-part-2.json'
import part3 from './term-1/class-1/transcript-part-3.json'
import part4 from './term-1/class-1/transcript-part-4.json'

export type LivingLamRimParagraph = {
  id: string
  speaker: string
  text: string
  startSeconds: number | null
}

export type LivingLamRimChapter = {
  id: string
  title: string
  paragraphs: LivingLamRimParagraph[]
}

export const livingLamRimTranscripts: Record<string, LivingLamRimChapter[]> = {
  'llr-t1-c1': [
    ...part1.chapters,
    ...part2.chapters,
    ...part3.chapters,
    ...part4.chapters,
  ],
}

export function livingLamRimTranscriptForSession(sessionId: string) {
  return livingLamRimTranscripts[sessionId] ?? []
}
