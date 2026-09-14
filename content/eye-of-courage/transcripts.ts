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

export type EyeOfCourageTranscriptParagraph = {
  id: string
  speaker: string
  text: string
}

export type EyeOfCourageTranscriptChapter = {
  id: string
  title: string
  paragraphs: EyeOfCourageTranscriptParagraph[]
}

export const eyeOfCourageTranscripts: Record<string, EyeOfCourageTranscriptChapter[]> = {
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
