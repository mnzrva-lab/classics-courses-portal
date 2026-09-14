import Link from 'next/link'
import ClassSequenceNavigation from '@/components/class-sequence-navigation'
import MarkdownContent from '@/components/markdown-content'
import RecordingPlayer from '@/components/recording-player'
import { eyeOfCourageProgram, eyeOfCourageSession, eyeOfCourageSessions, eyeOfCourageStudyNotes } from '@/content/eye-of-courage'

export default function EyeOfCourageClassPage({ sessionSlug }: { sessionSlug: 'class-1' | 'class-2' }) {
  const session = eyeOfCourageSession(sessionSlug)
  if (!session) return null
  const index = eyeOfCourageSessions.findIndex(item => item.slug === session.slug)
  const previous = index > 0 ? eyeOfCourageSessions[index - 1] : null
  const next = index < eyeOfCourageSessions.length - 1 ? eyeOfCourageSessions[index + 1] : null
  const notes = eyeOfCourageStudyNotes[session.id]
  return <main className="container page eoc-class-page">
    <div className="offering-breadcrumbs"><Link href="/other-programs">Other Programs</Link><span>/</span><Link href="/other-programs/eye-of-courage">The Eye of Courage</Link><span>/</span><span>{session.label}</span></div>
    <header className="eoc-class-header"><div><div className="eyebrow">{eyeOfCourageProgram.subtitle}</div><h1>{session.label}</h1><p className="lead">{session.date} · {session.teacher} · Casa Tartuk, Guadalajara</p></div>{session.hasWorkshop ? <nav className="eoc-class-tabs"><Link className="active" href="/other-programs/eye-of-courage/class-2">Class 2</Link><Link href="/other-programs/eye-of-courage/class-2/workshop">Workshop</Link></nav> : null}</header>
    <section className="section"><div className="eyebrow">Recording</div><h2>Class recording</h2><RecordingPlayer recordingUrl={session.recordingUrl} title={`${eyeOfCourageProgram.title}: ${eyeOfCourageProgram.subtitle} · ${session.label}`} /></section>
    {session.hasWorkshop ? <aside className="eoc-workshop-invite card cream"><div><div className="eyebrow">Put the teaching into practice</div><h2>Continue with the Workshop</h2><p>Choose one pattern, work with it directly, and continue the seven-day practice. Your answers stay on your device unless you download them.</p></div><div className="actions"><Link className="button sage" href="/other-programs/eye-of-courage/class-2/workshop">Start the Workshop</Link></div></aside> : null}
    <section className="section" id="study-notes"><div className="eyebrow">Study aid</div><h2>Study Notes</h2><div className="info-callout"><strong>About these notes</strong><br/>These are concise review notes, not a verbatim transcript. Check the source transcript against the class video or audio for exact wording.</div><div className="study-notes-summary card"><div className="eyebrow">Covered in this class</div><h3>Top ideas</h3><p>{notes.summary}</p><div className="study-topic-list">{notes.topics.map(topic => <span className="pill" key={topic}>{topic}</span>)}</div><details className="full-study-notes"><summary>▶ View full Study Notes</summary><div className="full-study-notes-body"><MarkdownContent content={notes.markdown}/></div></details></div></section>
    <section className="section transcript-section-v12" id="transcript"><div className="eyebrow">Reference Transcript</div><h2>Reference Transcript</h2><div className="info-callout"><strong>Source preserved</strong><br/>The cleaned DOCX transcript supplied for this class is the reference source. Its complete paragraph-by-paragraph import is being connected in a separate content pass so the source text is not shortened or altered.</div></section>
    <ClassSequenceNavigation previous={previous ? { href:`/other-programs/eye-of-courage/${previous.slug}`, label:previous.label } : null} next={next ? { href:`/other-programs/eye-of-courage/${next.slug}`, label:next.label } : null} allHref="/other-programs/eye-of-courage" allLabel="The Eye of Courage" />
  </main>
}
