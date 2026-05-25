import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { orders, restaurantTables } from '@/db/schema'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json() as { status?: string; notes?: string; total?: string }

  const isClosed = body.status === 'paid' || body.status === 'cancelled'
  const [order] = await db
    .update(orders)
    .set({ ...body, updatedAt: new Date(), closedAt: isClosed ? new Date() : undefined })
    .where(eq(orders.id, id))
    .returning()

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (isClosed && order.tableId) {
    await db.update(restaurantTables).set({ status: 'available' }).where(eq(restaurantTables.id, order.tableId))
  }
  if (body.status === 'sent_to_kitchen' && order.tableId) {
    await db.update(restaurantTables).set({ status: 'occupied' }).where(eq(restaurantTables.id, order.tableId))
  }

  return NextResponse.json(order)
}
