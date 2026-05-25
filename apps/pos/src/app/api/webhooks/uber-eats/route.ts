import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { businessSettings, orders, orderItems, webhookLog } from '@/db/schema'
import { validateUberEatsSignature } from '@/lib/webhook-utils'

interface UberEatsItem {
  id: string
  title: string
  quantity: number
  price: { unit_price: { amount: number; currency_code: string } }
  special_instructions?: string
}

interface UberEatsOrder {
  id: string
  store: { id: string }
  items: UberEatsItem[]
}

interface UberEatsPayload {
  event_type: string
  order: UberEatsOrder
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-uber-signature-sha256') ?? ''

  let parsed: UberEatsPayload
  try {
    parsed = JSON.parse(rawBody) as UberEatsPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const storeId = parsed.order?.store?.id
  if (!storeId) return NextResponse.json({ error: 'Missing store id' }, { status: 400 })

  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.uberEatsStoreId, storeId))
    .limit(1)

  if (!settings) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const secret = process.env.UBER_EATS_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  if (!validateUberEatsSignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const [log] = await db.insert(webhookLog).values({
    platform:   'uber_eats',
    businessId: settings.businessId,
    eventType:  parsed.event_type,
    payload:    rawBody,
    status:     'received',
  }).returning()

  if (parsed.event_type !== 'orders.notification') {
    return NextResponse.json({ ok: true })
  }

  try {
    const ueOrder = parsed.order
    const identifier = `UE-${ueOrder.id.slice(-6).toUpperCase()}`

    const orderId = await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values({
        businessId: settings.businessId,
        channel:    'DELIVERY',
        identifier,
        waiterId:   'uber_eats',
        status:     'sent_to_kitchen',
      }).returning()

      await tx.insert(orderItems).values(
        ueOrder.items.map((item) => ({
          orderId:   order.id,
          productId: null,
          name:      item.title,
          quantity:  item.quantity,
          unitPrice: String((item.price.unit_price.amount / 100).toFixed(2)),
          notes:     item.special_instructions ?? null,
          status:    'pending' as const,
        })),
      )

      return order.id
    })

    await db.update(webhookLog)
      .set({ status: 'processed' })
      .where(eq(webhookLog.id, log.id))

    return NextResponse.json({ ok: true, orderId })
  } catch (err) {
    await db.update(webhookLog)
      .set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
      .where(eq(webhookLog.id, log.id)).catch(() => {})
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
