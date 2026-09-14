import part1 from './timed-transcripts/course-17-class-10-part-1.json'
import part2 from './timed-transcripts/course-17-class-10-part-2.json'
import part3 from './timed-transcripts/course-17-class-10-part-3.json'
import part4 from './timed-transcripts/course-17-class-10-part-4.json'

export type TimedTranscriptParagraph = {
  id: string
  speaker: string
  blockType: string
  isChapter: boolean
  html: string
  startMs: number | null
  endMs: number | null
  confidence: number
  status: string
}

export type TimedTranscript = {
  schemaVersion: number
  transcriptFile: string
  timingFile: string
  alignmentStart: {
    paragraphIndex: number
    paragraphId: string
    startMs: number
    confidence: number
    method: string
    phrase: string
  }
  paragraphs: TimedTranscriptParagraph[]
}

const course17Class10: TimedTranscript = {
  schemaVersion: 2,
  transcriptFile: 'ENG ACI17_C10 Transcript.docx',
  timingFile: 'ENG ACI 17 Class 10 with Timothy D. Lowenhauptt (Aug 23, 2026) [English (auto-generated)].srt',
  alignmentStart: {
    paragraphIndex: 4,
    paragraphId: 'p-5',
    startMs: 82640,
    confidence: 0.896,
    method: 'first-successful-spoken-match',
    phrase: "because there's so much here and obviously i was realizing",
  },
  paragraphs: [...part1, ...part2, ...part3, ...part4] as TimedTranscriptParagraph[],
}

export function timedTranscriptFor(courseNumber: number, offeringSlug: string, sessionCode: string) {
  if (courseNumber === 17 && offeringSlug === 'current-2026' && sessionCode === 'C10') return course17Class10
  return null
}
