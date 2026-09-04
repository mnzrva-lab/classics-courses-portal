import Link from 'next/link'
import { notFound } from 'next/navigation'
import ContentDownloadLinks from '@/components/content-download-links'
import RecordingPlayer from '@/components/recording-player'
import TranscriptControls from '@/components/transcript-controls'
import rawCatalog from '@/content/living-lam-rim/catalog.json'
import { livingLamRimTranscriptForSession } from '@/content/living-lam-rim/transcripts'

type Session = {
  id: string
  slug: string
  code: string
  label: string
  kind: string
  date: string
  duration: string
  recordingUrl: string
  transcriptSource: string | null
}

type Term = {
  term: number
  slug: string
  title: string | null
  sessions: Session[]
}

type Catalog = {
  program: { title: string }
  terms: Term[]
}

const catalog = rawCatalog as Catalog

export default async function LivingLamRimSessionPage({ params }: { params: Promise<{ termSlug: string; sessionSlug: string }> }) {
  const { termSlug, sessionSlug } = await params
  const term = catalog.terms.find((item) => item.slug === termSlug)
  if (!term) notFound()
  const session = term.sessions.find((item) => item.slug === sessionSlug)
  if (!session) notFound()

  const transcriptChapters = livingLamRimTranscriptForSession(session.id)

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/living-lam-rim">Living Lam Rim</Link><span>/</span>
        <Link href={`/living-lam-rim/${term.slug}`}>Term {term.term}{term.title ? ` · ${term.title}` : ''}</Link><span>/</span>
        <span>{session.label}</span>
      </div>

      <section className="section">
        <div className="eyebrow">Living Lam Rim · Term {term.term}</div>
        <h1>{session.label}</h1>
        <p className="lead">{session.date} · Timothy Lowenhaupt · {session.duration}</p>
      </section>

      <section className="section" id="recording">
        <div className="eyebrow">Recording</div>
        <h2>Class recording</h2>
        <RecordingPlayer recordingUrl={session.recordingUrl} title={`${catalog.program.title} · Term ${term.term} · ${session.label}`} />
      </section>

      <section className="section transcript-section-v12" id="transcript" style={{ scrollMarginTop: 96 }}>
        <div className="eyebrow">Reference Transcript</div>
        <h2>{transcriptChapters.length ? 'Reference Transcript' : 'Transcript not added yet'}</h2>

        {transcriptChapters.length ? (
          <>
            <ContentDownloadLinks collection="living-lam-rim" sessionId={session.id} content="transcript" />
            <div className="info-callout">
              <strong>About this transcript</strong><br />
              This transcript was created by a student with AI and should be used for reference only. Please check it against the video and audio for accuracy of content.
            </div>
            <TranscriptControls chapters={transcriptChapters.map((chapter) => ({ id: chapter.id, label: chapter.title }))} />
            <article className="transcript-v12-card">
              {transcriptChapters.map((chapter) => (
                <section key={chapter.id} id={chapter.id} style={{ scrollMarginTop: 96, marginBottom: 34 }}>
                  <h3>{chapter.title}</h3>
                  {chapter.paragraphs.map((paragraph) => (
                    <div className="transcript-paragraph-v12" data-transcript-paragraph id={paragraph.id} key={paragraph.id} style={{ scrollMarginTop: 96 }}>
                      <div className="transcript-copy">
                        <strong>{paragraph.speaker}: </strong>
                        <span style={{ whiteSpace: 'pre-wrap' }}>{paragraph.text}</span>
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </article>
          </>
        ) : (
          <p className="meta">The recording is available, but a Reference Transcript has not been added to the Library for this session yet.</p>
        )}
      </section>
    </main>
  )
}
