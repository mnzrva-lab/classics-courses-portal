import type { ReactNode } from 'react'

export type LibraryCourseArtwork = {
  src: string
  alt: string
  width?: number
  height?: number
  position?: string
}

type Props = {
  eyebrow: string
  title: string
  subtitle?: string
  facts?: readonly string[]
  description?: string
  artwork?: LibraryCourseArtwork
  children?: ReactNode
}

/**
 * Standard public course/term hero. The approved Eye of Courage layout is the
 * reference: image on the left, course information on the right, stacked on mobile.
 * No image means a text-only card; never invent a cover or a teacher.
 */
export default function LibraryCourseHero({
  eyebrow,
  title,
  subtitle,
  facts = [],
  description,
  artwork,
  children,
}: Props) {
  return (
    <header
      className={'library-course-hero' + (artwork ? ' has-artwork' : ' no-artwork')}
      data-library-page="course"
      data-layout-standard="course-hero-v1"
    >
      {artwork ? (
        <div className="library-course-hero-artwork">
          <img
            src={artwork.src}
            alt={artwork.alt}
            width={artwork.width}
            height={artwork.height}
            style={artwork.position ? { objectPosition: artwork.position } : undefined}
            loading="eager"
            decoding="async"
          />
        </div>
      ) : null}
      <div className="library-course-hero-copy">
        <div className="eyebrow library-course-hero-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle ? <p className="library-course-hero-subtitle">{subtitle}</p> : null}
        {facts.length ? (
          <div className="library-course-hero-facts" aria-label="Course details">
            {facts.map((fact, index) => <span key={index}>{fact}</span>)}
          </div>
        ) : null}
        {description ? <p className="library-course-hero-description">{description}</p> : null}
        {children ? <div className="library-course-hero-extra">{children}</div> : null}
      </div>
    </header>
  )
}
