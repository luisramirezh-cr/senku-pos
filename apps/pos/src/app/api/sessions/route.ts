import { auth } from '@clerk/nextjs/server'
import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { cashSessions } from '@/db/schema'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const rows = await db
    .select()
    .from(cashSessions)
    .where(and(eq(cashSessions.businessId, businessId), eq(cashSessions.cashierId, userId)))
    .orderBy(cashSessions.openedAt)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { businessId, openingBalance } = await req.json() as {
    businessId: string
    openingBalance: string
  }

  // Prevent duplicate open session
  const existing = await db.query.cashSessions.findFirst({
    where: (s, { and, eq }) =>
      and(eq(s.businessId, businessId), eq(s.cashierId, userId), eq(s.status, 'open')),
  })
  if (existing) return NextResponse.json({ error: 'Ya hay un turno abierto' }, { status: 409 })

  const [session] = await db
    .insert(cashSessions)
    .values({ businessId, cashierId: userId, openingBalance, status: 'open' })
    .returning()

  return NextResponse.json(session, { status: 201 })
}
