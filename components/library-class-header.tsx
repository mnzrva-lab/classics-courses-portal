import type { ReactNode } from 'react'

type Props = {
  eyebrow: string
  title: string
  meta?: string
  className?: string
  children?: ReactNode
}

/** Standard class page header. Breadcrumbs are rendered immediately before it. */
export default function LibraryClassHeader({ eyebrow, title, meta, className = '', children }: Props) {
  return (
    <header className={'library-class-heading compact-page-head ' + className} data-library-page="class" data-layout-standard="class-v1">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {meta ? <p className="lead">{meta}</p> : null}
      {children}
    </header>
  )
}
