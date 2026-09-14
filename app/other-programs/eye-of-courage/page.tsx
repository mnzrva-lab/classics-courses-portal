import Link from 'next/link'
import LibrarySessionList from '@/components/library-session-list'
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

      <header className="eoc-program-intro">
        <div className="eoc-program-cover-wrap">
          <img className="eoc-program-cover" src={eyeOfCourageProgram.coverPath} alt="Tigers overlooking Guadalajara at sunset" />
        </div>
        <div className="eoc-program-copy">
          <div className="eyebrow">Special teaching · Casa Tartuk</div>
          <h1>{eyeOfCourageProgram.title}</h1>
          <p className="eoc-program-subtitle">{eyeOfCourageProgram.subtitle}</p>
          <p className="lead">{eyeOfCourageProgram.location}<br />{eyeOfCourageProgram.dates}</p>
          <p>{eyeOfCourageProgram.description}</p>
          <p className="meta">Teacher · {eyeOfCourageProgram.teacher}</p>
        </div>
      </header>

      <section className="section compact-section">
        <div className="section-head"><div><div className="eyebrow">Course content</div><h2>Classes &amp; recordings</h2></div></div>
        <LibrarySessionList rows={rows} />
      </section>
    </main>
  )
}
