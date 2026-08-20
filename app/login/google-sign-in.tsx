'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function GoogleSignIn() {
  const [loading, setLoading] = useState(false)

  async function signIn() {
    setLoading(true)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=/my-learning`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })

    if (error) {
      setLoading(false)
      alert('Google sign-in could not be started. Please try again.')
    }
  }

  return (
    <button className="button red" onClick={signIn} disabled={loading}>
      {loading ? 'Opening Google…' : 'Continue with Google'}
    </button>
  )
}
