import Link from 'next/link'

type NavItem = {
  href: string
  label: string
} | null

type Props = {
  previous?: NavItem
  next?: NavItem
  allHref: string
  allLabel?: string
}

export default function ClassSequenceNavigation({ previous = null, next = null, allHref, allLabel = 'All classes' }: Props) {
  return (
    <nav className="class-sequence-nav" aria-label="Class navigation">
      <div className="class-sequence-side class-sequence-prev">
        {previous ? <Link className="button" href={previous.href}>← {previous.label}</Link> : null}
      </div>
      <Link className="class-sequence-all" href={allHref}>{allLabel}</Link>
      <div className="class-sequence-side class-sequence-next">
        {next ? <Link className="button" href={next.href}>{next.label} →</Link> : null}
      </div>
    </nav>
  )
}
