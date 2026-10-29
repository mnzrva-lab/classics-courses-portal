import type { ReactNode } from 'react'

type Props = {
  id?: string
  eyebrow: string
  title: string
  className?: string
  children: ReactNode
}

/** Reusable class section for recordings, notes, transcripts and source materials. */
export default function LibraryClassSection({ id, eyebrow, title, className = '', children }: Props) {
  return (
    <section id={id} className={'section library-class-section ' + className}>
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {children}
    </section>
  )
}
