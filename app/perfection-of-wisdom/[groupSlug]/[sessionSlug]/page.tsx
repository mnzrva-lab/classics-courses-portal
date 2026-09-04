import Link from 'next/link'
import { notFound } from 'next/navigation'
import ClassSequenceNavigation from '@/components/class-sequence-navigation'
import ContentDownloadLinks from '@/components/content-download-links'
import MarkdownContent from '@/components/markdown-content'
import RecordingPlayer from '@/components/recording-player'
import TranscriptControls from '@/components/transcript-controls'
import { perfectionGroups, perfectionProgram, perfectionSessionBySlug } from '@/content/perfection-of-wisdom/catalog'
import { perfectionTranscriptForSession } from '@/content/perfection-of-wisdom/transcripts'

const transcriptDisclaimer = 'This transcript was created by a student with AI and should be used for reference only. Please check it against the video and audio for accuracy of content.'

export default async function PerfectionSessionPage({ params }: { params: Promise<{ groupSlug: string; sessionSlug: string }> }) {
  const { groupSlug, sessionSlug } = await params
  const entry = perfectionSessionBySlug(groupSlug, sessionSlug)
  if (!entry) notFound()

  const { group, session } = entry
  const transcriptChapters = perfectionTranscriptForSession(session.id)
  const orderedSessions = perfectionGroups.flatMap((period) => period.sessions.map((item) => ({ period, session: item })))
  const sessionIndex = orderedSessions.findIndex((item) => item.period.slug === groupSlug && item.session.slug === sessionSlug)
  const previous = sessionIndex > 0 ? orderedSessions[sessionIndex - 1] : null
  const next = sessionIndex >= 0 && sessionIndex < orderedSessions.length - 1 ? orderedSessions[sessionIndex + 1] : null

  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/perfection-of-wisdom">Perfection of Wisdom</Link><span>/</span>
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
            <ContentDownloadLinks collection="perfection" sessionId={session.id} content="transcript" />
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

      <ClassSequenceNavigation
        previous={previous ? { href: `/perfection-of-wisdom/${previous.period.slug}/${previous.session.slug}`, label: previous.session.name } : null}
        next={next ? { href: `/perfection-of-wisdom/${next.period.slug}/${next.session.slug}`, label: next.session.name } : null}
        allHref="/perfection-of-wisdom"
        allLabel="All sessions"
      />
    </main>
  )
}
