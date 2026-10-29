import { redirect } from 'next/navigation'

// Previously shared preview links go to the original Classics Courses section.
export default function OldLibraryLink() {
  redirect('/courses')
}
