import { auth } from '@clerk/nextjs/server'
import { and, eq, gte, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { cashSessions, sales } from '@/db/schema'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { closingBalance } = await req.json() as { closingBalance: string }

  const session = await db.query.cashSessions.findFirst({
    where: (s, { eq }) => eq(s.id, id),
  })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (session.cashierId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Sum sales during this session
  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(total), 0)` })
    .from(sales)
    .where(
      and(
        eq(sales.businessId, session.businessId),
        eq(sales.cashierId, userId),
        gte(sales.createdAt, session.openedAt),
      ),
    )

  const [closed] = await db
    .update(cashSessions)
    .set({ closedAt: new Date(), closingBalance, totalSales: total, status: 'closed' })
    .where(eq(cashSessions.id, id))
    .returning()

  return NextResponse.json(closed)
}
