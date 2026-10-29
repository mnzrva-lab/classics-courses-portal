import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LibraryCourseHero from '@/components/library-course-hero'
import LibraryClassSection from '@/components/library-class-section'
import LibraryTranscriptReader from '@/components/library-transcript-reader'
import MarkdownContent from '@/components/markdown-content'
import TranscriptNotice from '@/components/transcript-notice'
import RecordingPlayer from '@/components/recording-player'
import { getStandaloneTeachingContent } from '@/lib/standalone-content'

export const revalidate = 60
type Params = { teachingSlug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { teachingSlug } = await params
  const content = await getStandaloneTeachingContent(teachingSlug)
  return content ? { title: content.teaching.title } : {}
}

function DownloadLinks({ slug, content }: { slug: string; content: 'transcript' | 'notes' }) {
  const base = '/other-programs/' + slug + '/download?content=' + content + '&format='
  return (
    <div className="content-download-links">
      <span>Download:</span>
      <a href={base + 'txt'}>TXT</a>
      <span aria-hidden="true">·</span>
      <a href={base + 'docx'}>DOCX</a>
    </div>
  )
}

export default async function StandaloneTeachingPage({ params }: { params: Promise<Params> }) {
  const { teachingSlug } = await params
  const content = await getStandaloneTeachingContent(teachingSlug)
  if (!content) notFound()
  const { teaching, transcript, studyNotes } = content
  return (
    <main className="container page">
      <div className="offering-breadcrumbs">
        <Link href="/other-programs">Other Programs</Link>
        <span>/</span><span>{teaching.title}</span>
      </div>
      <LibraryCourseHero
        eyebrow="Standalone teaching"
        title={teaching.title}
        subtitle={teaching.subtitle}
        facts={[teaching.date, teaching.teacher ? 'Teacher · ' + teaching.teacher : null]
          .filter((v): v is string => Boolean(v))}
        description={teaching.description}
        artwork={teaching.cover ? {
          src: teaching.cover, alt: teaching.artworkAlt ?? teaching.title,
          width: 1920, height: 1080,
        } : undefined}
      />
      {teaching.recordingUrl ? (
        <LibraryClassSection id="recording" eyebrow="Recording" title="Teaching recording">
          <RecordingPlayer recordingUrl={teaching.recordingUrl} title={teaching.title} />
        </LibraryClassSection>
      ) : null}
      {studyNotes ? (
        <LibraryClassSection id="study-notes" eyebrow="Study Notes" title="Study Notes">
          <DownloadLinks slug={teachingSlug} content="notes" />
          <div className="study-notes-copy"><MarkdownContent content={studyNotes} /></div>
        </LibraryClassSection>
      ) : null}
      {transcript || teaching.transcript ? (
        <LibraryClassSection id="transcript" eyebrow="Reference Transcript"
          title={transcript ? 'Reference Transcript' : 'Transcript temporarily unavailable'}>
          {transcript ? <>
            <TranscriptNotice />
            <DownloadLinks slug={teachingSlug} content="transcript" />
            <LibraryTranscriptReader chapters={transcript.chapters}
              programTitle={teaching.title} sessionTitle={teaching.title}
              sessionDate={teaching.date ?? ''} sessionPath={teaching.href} />
          </> : <p className="meta">Transcript temporarily unavailable.</p>}
        </LibraryClassSection>
      ) : null}
      {teaching.materials?.length ? (
        <LibraryClassSection eyebrow="Materials" title="Reading and resources">
          <ul>{teaching.materials.map(material => (
            <li key={material.url}>
              <a className="inline-library-link" href={material.url}
                target="_blank" rel="noreferrer">{material.label}</a>
            </li>
          ))}</ul>
        </LibraryClassSection>
      ) : null}
    </main>
  )
}
