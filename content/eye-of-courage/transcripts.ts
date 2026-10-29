import class1Part1 from './class-1-transcript-part-1.json'
import class1Part2 from './class-1-transcript-part-2.json'
import class1Part3 from './class-1-transcript-part-3.json'
import class1Part4 from './class-1-transcript-part-4.json'
import class1Part5 from './class-1-transcript-part-5.json'
import class1Part6 from './class-1-transcript-part-6.json'
import class2Part1 from './class-2-transcript-part-1.json'
import class2Part2 from './class-2-transcript-part-2.json'
import class2Part3 from './class-2-transcript-part-3.json'
import class2Part4 from './class-2-transcript-part-4.json'
import class2Part5 from './class-2-transcript-part-5.json'
import class2Part6 from './class-2-transcript-part-6.json'
import class2Part7 from './class-2-transcript-part-7.json'
import timingMap from './timing-map.json'

export type EyeOfCourageTranscriptParagraph = {
  id: string
  speaker: string
  text: string
  startSeconds?: number | null
  timingSource?: 'youtube-caption' | 'estimated'
}

export type EyeOfCourageTranscriptChapter = {
  id: string
  title: string
  paragraphs: EyeOfCourageTranscriptParagraph[]
}

const originalEyeOfCourageTranscripts: Record<'class-1' | 'class-2', EyeOfCourageTranscriptChapter[]> = {
  'class-1': [
    ...class1Part1.chapters,
    ...class1Part2.chapters,
    ...class1Part3.chapters,
    ...class1Part4.chapters,
    ...class1Part5.chapters,
    ...class1Part6.chapters,
  ],
  'class-2': [
    ...class2Part1.chapters,
    ...class2Part2.chapters,
    ...class2Part3.chapters,
    ...class2Part4.chapters,
    ...class2Part5.chapters,
    ...class2Part6.chapters,
    ...class2Part7.chapters,
  ],
}

/** Adds SRT-reviewed timestamps by existing Library passage ID without changing source wording. */
type EyeTimingEntry = { startSeconds: number; timingSource: 'youtube-caption' | 'estimated'; sourceParagraphId: string }
function applyEyeTiming(classId: 'class-1' | 'class-2'): EyeOfCourageTranscriptChapter[] {
  const byId = timingMap.classes[classId].paragraphs as Record<string, EyeTimingEntry>
  return originalEyeOfCourageTranscripts[classId].map(chapter => ({
    ...chapter,
    paragraphs: chapter.paragraphs.map(paragraph => {
      const timing = byId[paragraph.id]
      if (!timing) throw new Error('Missing Eye of Courage timing for ' + paragraph.id)
      return { ...paragraph, startSeconds: timing.startSeconds, timingSource: timing.timingSource }
    }),
  }))
}
export const eyeOfCourageTranscripts: Record<string, EyeOfCourageTranscriptChapter[]> = {
  'class-1': applyEyeTiming('class-1'),
  'class-2': applyEyeTiming('class-2'),
}
