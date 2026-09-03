import Link from 'next/link'
import { perfectionGroups, perfectionProgram } from '@/content/perfection-of-wisdom/catalog'

const recordingCount = perfectionGroups.reduce((total, group) => total + group.sessions.length, 0)

export default function OtherProgramsPage() {
  return (
    <main className="container page">
      <div className="eyebrow">Other teachings</div>
      <h1>Other teachings and study projects</h1>
      <p className="lead">Text studies, translation projects, and teaching archives that sit outside the 18 Classics Courses.</p>

      <section className="section grid two">
        <article className="card">
          <div className="eyebrow">Diamond Cutter Classics · Book 1</div>
          <h2 style={{ fontSize: 30 }}>{perfectionProgram.title}</h2>
          <p><i>String of White Lotuses</i> · PAD MA DKAR PO’I PHRENG BA</p>
          <p className="meta">{perfectionGroups.length} archive groups · {recordingCount} recordings currently recovered from the supplied source archive.</p>
          <div className="actions"><Link className="button sage" href="/perfection-of-wisdom">Open teaching archive</Link></div>
        </article>

        <article className="card cream">
          <div className="eyebrow">Future programs</div>
          <h2 style={{ fontSize: 30 }}>Additional teaching projects</h2>
          <p>New teaching series can live here without forcing them into the Classics curriculum.</p>
          <p className="meta">We will add each archive after its source materials, recordings, and structure have been reviewed.</p>
          <div className="actions"><span className="pill">Source material needed</span></div>
        </article>
      </section>
    </main>
  )
}
