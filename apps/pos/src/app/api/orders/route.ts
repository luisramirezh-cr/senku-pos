import { auth } from '@clerk/nextjs/server'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { orders, orderItems, orderItemModifiers } from '@/db/schema'
import { assertBusinessAccess } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const p = req.nextUrl.searchParams
  const businessId = p.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const denied = await assertBusinessAccess(userId, businessId)
  if (denied) return denied

  const status = p.get('status')
  const counter = p.get('counter')
  const conditions = [eq(orders.businessId, businessId)]
  if (status) conditions.push(eq(orders.status, status))
  if (counter) conditions.push(eq(orders.counter, counter))

  const rows = await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.openedAt)).limit(100)

  if (rows.length === 0) return NextResponse.json([])
  const orderIds = rows.map((r) => r.id)
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))

  const itemIds = items.map((i) => i.id)
  const modifiers = itemIds.length
    ? await db.select().from(orderItemModifiers).where(inArray(orderItemModifiers.orderItemId, itemIds))
    : []

  const modsByItem = modifiers.reduce<Record<string, typeof modifiers>>((acc, m) => {
    if (!acc[m.orderItemId]) acc[m.orderItemId] = []
    acc[m.orderItemId].push(m)
    return acc
  }, {})

  const itemsByOrder = items.reduce<Record<string, (typeof items[0] & { modifiers: typeof modifiers })[]>>((acc, item) => {
    if (!acc[item.orderId]) acc[item.orderId] = []
    acc[item.orderId].push({ ...item, modifiers: modsByItem[item.id] ?? [] })
    return acc
  }, {})

  return NextResponse.json(rows.map((r) => ({ ...r, items: itemsByOrder[r.id] ?? [] })))
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as {
    businessId: string
    channel: string
    tableId?: string
    identifier?: string
    counter?: string
  }
  if (!body.businessId || !body.channel) return NextResponse.json({ error: 'businessId and channel required' }, { status: 400 })

  const [order] = await db.insert(orders).values({
    businessId: body.businessId,
    channel: body.channel,
    tableId: body.tableId ?? null,
    identifier: body.identifier ?? null,
    counter: body.counter ?? null,
    waiterId: userId,
    status: 'open',
  }).returning()
  return NextResponse.json(order, { status: 201 })
}
