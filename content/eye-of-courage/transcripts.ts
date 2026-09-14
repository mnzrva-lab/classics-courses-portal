export type EyeOfCourageTranscriptParagraph = { id: string; speaker: string; text: string }
export type EyeOfCourageTranscriptChapter = { id: string; title: string; paragraphs: EyeOfCourageTranscriptParagraph[] }

// The cleaned DOCX transcripts are the verified source. Their full paragraph import
// will be connected in a separate content pass so the new teaching can ship without
// changing or truncating the source text.
export const eyeOfCourageTranscripts: Record<string, EyeOfCourageTranscriptChapter[]> = {}
