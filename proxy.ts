import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  const termMatch = request.nextUrl.pathname.match(/^\/courses\/living-lam-rim\/(term-\d+)\/?$/i)
  if (termMatch) {
    const url = request.nextUrl.clone()
    url.pathname = `/living-lam-rim/${termMatch[1].toLowerCase()}`
    return NextResponse.redirect(url)
  }
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
