import Link from 'next/link'
import styles from './library-session-list.module.css'

export type LibrarySessionRow = {
  href: string
  code: string
  title: string
  meta: string
  status?: string | null
}

export default function LibrarySessionList({ rows }: { rows: LibrarySessionRow[] }) {
  return (
    <div className={styles.list}>
      {rows.map((row) => (
        <Link className={styles.module} href={row.href} key={`${row.href}-${row.code}`}>
          <span className={styles.num}>{row.code}</span>
          <span className={styles.copy}>
            <b>{row.title}</b>
            <small>{row.meta}</small>
          </span>
          {row.status ? <span className={styles.status}>{row.status}</span> : null}
        </Link>
      ))}
    </div>
  )
}
