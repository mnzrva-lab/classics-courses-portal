import Link from 'next/link'
import { notFound } from 'next/navigation'
import MarkdownContent from '@/components/markdown-content'
import RecordingPlayer from '@/components/recording-player'
import TranscriptControls from '@/components/transcript-controls'
import { perfectionProgram, perfectionSessionBySlug } from '@/content/perfection-of-wisdom/catalog'
import { perfectionTranscriptForSession } from '@/content/perfection-of-wisdom/transcripts'

const transcriptDisclaimer = 'This transcript was created by a student with AI and should be used for reference only. Please check them against the video and audio for accuracy of content.'

export default async function PerfectionSessionPage({ params }: { params: Promise<{ groupSlug: string; sessionSlug: string }> }) {
  const { groupSlug, sessionSlug } = await params
  const entry = perfectionSessionBySlug(groupSlug, sessionSlug)
  if (!entry) notFound()

  const { group, session } = entry
  const transcriptChapters = perfectionTranscriptForSession(session.id)

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/perfection-of-wisdom">Perfection of Wisdom</Link><span>/</span>
        <Link href={`/perfection-of-wisdom/${group.slug}`}>{group.title}</Link><span>/</span>
        <span>{session.code}</span>
      </div>

      <section className="section">
        <div className="eyebrow">{perfectionProgram.eyebrow} · {group.title}</div>
        <h1>{session.name}</h1>
        <p className="lead">{session.date} · {session.teacher} · {session.duration}</p>
      </section>

      <section className="section" id="recording">
        <div className="eyebrow">Recording</div>
        <h2>Session recording</h2>
        <RecordingPlayer recordingUrl={session.recordingUrl} title={`${perfectionProgram.title} · ${session.name}`} />
      </section>

      <section className="section transcript-section-v12" id="transcript" style={{ scrollMarginTop: 96 }}>
        <div className="eyebrow">Reference Transcript</div>
        <h2>{transcriptChapters.length ? 'Reference Transcript' : 'Transcript not added yet'}</h2>

        {transcriptChapters.length ? (
          <>
            <div className="info-callout"><strong>About this transcript</strong><br />{transcriptDisclaimer}</div>
            <TranscriptControls chapters={transcriptChapters.map((chapter) => ({ id: chapter.id, label: chapter.title.replace(/[*_`]/g, '') }))} />
            <article className="transcript-v12-card">
              {transcriptChapters.map((chapter) => (
                <section key={chapter.id} id={chapter.id} style={{ scrollMarginTop: 96, marginBottom: 34 }}>
                  <h3>{chapter.title.replace(/[*_`]/g, '')}</h3>
                  {chapter.paragraphs.map((paragraph) => (
                    <div className="transcript-paragraph-v12" data-transcript-paragraph id={paragraph.id} key={paragraph.id} style={{ scrollMarginTop: 96 }}>
                      <div className="transcript-copy">
                        {paragraph.speaker ? <div><strong>{paragraph.speaker}</strong></div> : null}
                        <MarkdownContent content={paragraph.text} />
                      </div>
                      <div className="meta" style={{ marginTop: 8 }}><a href={`#${paragraph.id}`}>§ {paragraph.id}</a></div>
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
