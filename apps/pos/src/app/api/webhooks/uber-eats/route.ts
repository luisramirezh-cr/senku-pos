import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { businessSettings, orders, orderItems, webhookLog } from '@/db/schema'
import { validateUberEatsSignature } from '@/lib/webhook-utils'
import { fetchOrder, acceptOrder, denyOrder } from '@/lib/uber-eats-api'

interface UberEatsWebhookPayload {
  event_id:      string
  event_type:    string
  resource_id:   string
  resource_href: string
  meta?: Record<string, string>
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Verify HMAC before doing anything else
  const secret = process.env.UBER_EATS_CLIENT_SECRET
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const signature = req.headers.get('x-uber-signature') ?? ''
  if (!validateUberEatsSignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: UberEatsWebhookPayload
  try {
    payload = JSON.parse(rawBody) as UberEatsWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Non-order events: acknowledge and ignore
  if (payload.event_type !== 'orders.notification') {
    return NextResponse.json({ ok: true })
  }

  const orderId = payload.resource_id
  if (!orderId) return NextResponse.json({ error: 'Missing resource_id' }, { status: 400 })

  // Fetch full order from Uber Eats API
  let ueOrder: Awaited<ReturnType<typeof fetchOrder>>
  try {
    ueOrder = await fetchOrder(orderId)
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch order: ${err}` }, { status: 502 })
  }

  // Look up business by store ID
  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.uberEatsStoreId, ueOrder.store.id))
    .limit(1)

  if (!settings) {
    // Unknown store — deny so Uber doesn't retry forever
    await denyOrder(orderId, 'Store not registered in POS').catch(() => {})
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const identifier = `UE-${orderId.slice(-6).toUpperCase()}`

  const [log] = await db.insert(webhookLog).values({
    platform:   'uber_eats',
    businessId: settings.businessId,
    eventType:  payload.event_type,
    payload:    rawBody,
    status:     'received',
  }).returning()

  try {
    await db.transaction(async (tx) => {
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
    })

    // Acknowledge to Uber — must happen within 11.5 min of order creation
    await acceptOrder(orderId)

    await db.update(webhookLog)
      .set({ status: 'processed' })
      .where(eq(webhookLog.id, log.id))

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.update(webhookLog)
      .set({ status: 'error', error: message })
      .where(eq(webhookLog.id, log.id)).catch(() => {})
    await denyOrder(orderId, 'POS internal error').catch(() => {})
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
