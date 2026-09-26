import { NextResponse, type NextRequest } from 'next/server'

const disabledPrivatePrefixes = [
  '/account',
  '/login',
  '/auth',
  '/my-learning',
  '/my-notes',
  '/admin',
]

export function proxy(request: NextRequest) {
  const termMatch = request.nextUrl.pathname.match(/^\/courses\/living-lam-rim\/(term-\d+)\/?$/i)
  if (termMatch) {
    const url = request.nextUrl.clone()
    url.pathname = `/living-lam-rim/${termMatch[1].toLowerCase()}`
    return NextResponse.redirect(url)
  }

  const pathname = request.nextUrl.pathname.toLowerCase()
  if (disabledPrivatePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
