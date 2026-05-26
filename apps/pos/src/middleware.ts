import type { NextRequest } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)', '/api/health'])

export default clerkMiddleware(async (auth, request: NextRequest) => {
  if (isPublicRoute(request)) return NextResponse.next()

  const { userId, sessionClaims } = await auth()

  if (!userId) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }

  const role = (sessionClaims?.publicMetadata as Record<string, string>)?.role
  if (role !== 'business' && role !== 'superadmin' && role !== 'cashier') {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|ttf|otf)$).*)',
  ],
}
