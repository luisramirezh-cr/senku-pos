import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/root-api'

const COOKIE = 'senku_pos_active_business'
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 400, // 400 days
  path: '/',
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cookieStore = await cookies()
  const activeBusinessId = cookieStore.get(COOKIE)?.value

  const session = await getSession(userId, activeBusinessId)
  return NextResponse.json(session)
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { businessId } = await req.json() as { businessId: string }
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const session = await getSession(userId, businessId)

  const response = NextResponse.json(session)
  response.cookies.set(COOKIE, businessId, COOKIE_OPTS)
  return response
}
