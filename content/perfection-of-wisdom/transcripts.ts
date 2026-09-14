import part1 from './introduction-q-a-2021/first-qa-winter-2021/transcript-part-1.json'
import part2 from './introduction-q-a-2021/first-qa-winter-2021/transcript-part-2.json'
import part3 from './introduction-q-a-2021/first-qa-winter-2021/transcript-part-3.json'
import part4 from './introduction-q-a-2021/first-qa-winter-2021/transcript-part-4.json'

export type PerfectionTranscriptParagraph = {
  id: string
  speaker: string
  text: string
  startSeconds: number | null
}

export type PerfectionTranscriptChapter = {
  id: string
  title: string
  paragraphs: PerfectionTranscriptParagraph[]
}

export const perfectionTranscripts: Record<string, PerfectionTranscriptChapter[]> = {
  'pow-g1-s1': [
    ...part1.chapters,
    ...part2.chapters,
    ...part3.chapters,
    ...part4.chapters,
  ],
}

export function perfectionTranscriptForSession(sessionId: string) {
  return perfectionTranscripts[sessionId] ?? []
}
