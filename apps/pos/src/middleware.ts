import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/api/health'])

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth()
  const response = NextResponse.next()

  if (isPublicRoute(request)) return response

  const rootUrl = process.env.NEXT_PUBLIC_ROOT_URL ?? 'https://gosenku.com'

  if (!userId) {
    const signInUrl = new URL(`${rootUrl}/sign-in`)
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }

  const role = (sessionClaims?.publicMetadata as Record<string, string>)?.role
  if (role !== 'business' && role !== 'superadmin' && role !== 'cashier') {
    return NextResponse.redirect(new URL(`${rootUrl}/hub`))
  }

  return response
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|ttf|otf)$).*)',
  ],
}
