import Link from 'next/link'
import LibrarySessionList from '@/components/library-session-list'
import LibraryCourseHero from '@/components/library-course-hero'
import { eyeOfCourageProgram, eyeOfCourageSessions } from '@/content/eye-of-courage'

export default function EyeOfCourageProgramPage() {
  const classRows = eyeOfCourageSessions.map((session, index) => ({
    href: `/other-programs/eye-of-courage/${session.slug}`,
    code: `C${index + 1}`,
    title: session.label,
    meta: session.date,
    status: session.hasWorkshop ? 'Recording · Transcript · Study Notes · Workshop' : 'Recording · Transcript · Study Notes',
  }))

  const rows = [
    ...classRows,
    {
      href: '/other-programs/eye-of-courage/class-2#workshop',
      code: 'W',
      title: 'Workshop',
      meta: 'Class 2 practice',
      status: 'Interactive workbook',
    },
  ]

  return (
    <main className="container page eoc-program-page">
      <div className="offering-breadcrumbs"><Link href="/other-programs">Other Programs</Link><span>/</span><span>{eyeOfCourageProgram.title}</span></div>

      <LibraryCourseHero
        eyebrow="Special teaching · Casa Tartuk"
        title={eyeOfCourageProgram.title}
        subtitle={eyeOfCourageProgram.subtitle}
        artwork={{ src: eyeOfCourageProgram.coverPath, alt: 'Tigers overlooking Guadalajara at sunset', position: '38% center' }}
        facts={[
          eyeOfCourageProgram.location,
          eyeOfCourageProgram.dates,
          'Teacher · ' + eyeOfCourageProgram.teacher,
        ]}
        description={eyeOfCourageProgram.description}
      />

      <section className="section compact-section">
        <div className="section-head"><div><div className="eyebrow">Course content</div><h2>Classes &amp; recordings</h2></div></div>
        <LibrarySessionList rows={rows} />
      </section>
    </main>
  )
}
