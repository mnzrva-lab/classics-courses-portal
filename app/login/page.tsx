import Link from 'next/link'
import GoogleSignIn from './google-sign-in'

export default function LoginPage() {
  return (
    <main className="container page auth-wrap">
      <section className="card auth-card">
        <div className="eyebrow">Personal study account</div>
        <h2>Save your learning across devices</h2>
        <p className="lead" style={{ fontSize: 17 }}>
          Sign in to keep your notes, bookmarks, course progress, and personal study settings private to you.
        </p>
        <div className="actions" style={{ justifyContent: 'center' }}>
          <GoogleSignIn />
          <Link className="button" href="/courses">Keep browsing</Link>
        </div>
      </section>
    </main>
  )
}
