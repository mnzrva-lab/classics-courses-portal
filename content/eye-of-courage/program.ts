export type EyeOfCourageSession = {
  id: 'class-1' | 'class-2'
  slug: 'class-1' | 'class-2'
  label: string
  date: string
  teacher: string
  recordingUrl: string
  hasWorkshop: boolean
}

export const eyeOfCourageProgram = {
  slug: 'eye-of-courage',
  title: 'The Eye of Courage',
  subtitle: 'Blindspots & Leadership',
  teacher: 'Timothy Lowenhaupt',
  location: 'Guadalajara · Casa Tartuk',
  dates: 'September 11–12, 2026',
  description:
    'A two-evening teaching on automatic scripts, limiting beliefs, the conditions that let good seeds ripen, and the way leadership becomes more natural as old patterns weaken.',
  coverPath: '/eye-of-courage/cover.jpg',
  workbookPdfPath: 'https://drive.google.com/file/d/1jopJ4M44cvZokJ3E1815sl5PAinVOqaX/view?usp=sharing',
}

export const eyeOfCourageSessions: EyeOfCourageSession[] = [
  {
    id: 'class-1',
    slug: 'class-1',
    label: 'Class 1',
    date: 'September 11, 2026',
    teacher: 'Timothy Lowenhaupt',
    recordingUrl: 'https://drive.google.com/file/d/11mtGJeGwlgBjkfq0PzCQV1uhHL17lyFM/view?usp=sharing',
    hasWorkshop: false,
  },
  {
    id: 'class-2',
    slug: 'class-2',
    label: 'Class 2',
    date: 'September 12, 2026',
    teacher: 'Timothy Lowenhaupt',
    recordingUrl: 'https://drive.google.com/file/d/100qYlnJFPK9FUJ9cl55A1D7PhR8xpgiS/view?usp=sharing',
    hasWorkshop: true,
  },
]

export function eyeOfCourageSession(slug: string) {
  return eyeOfCourageSessions.find((session) => session.slug === slug) ?? null
}
