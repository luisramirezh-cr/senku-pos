import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { businessSettings, orders, orderItems, webhookLog } from '@/db/schema'
import { validatePedidosYaSignature } from '@/lib/webhook-utils'

interface PyItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  comments?: string
}

interface PyOrder {
  id: string
  restaurantId: string
  products: PyItem[]
}

interface PyPayload {
  event: string
  order: PyOrder
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-py-signature') ?? ''

  let parsed: PyPayload
  try {
    parsed = JSON.parse(rawBody) as PyPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const storeId = parsed.order?.restaurantId
  if (!storeId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 })

  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.pedidosYaStoreId, storeId))
    .limit(1)

  if (!settings) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const secret = process.env.PEDIDOS_YA_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  if (!validatePedidosYaSignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const [log] = await db.insert(webhookLog).values({
    platform:   'pedidos_ya',
    businessId: settings.businessId,
    eventType:  parsed.event,
    payload:    rawBody,
    status:     'received',
  }).returning()

  if (parsed.event !== 'ORDER_PENDING') {
    return NextResponse.json({ ok: true })
  }

  try {
    const pyOrder = parsed.order
    const identifier = `PY-${pyOrder.id.slice(-6).toUpperCase()}`

    const orderId = await db.transaction(async (tx) => {
      const [order] = await tx.insert(orders).values({
        businessId: settings.businessId,
        channel:    'DELIVERY',
        identifier,
        waiterId:   'pedidos_ya',
        status:     'sent_to_kitchen',
      }).returning()

      await tx.insert(orderItems).values(
        pyOrder.products.map((item) => ({
          orderId:   order.id,
          productId: null,
          name:      item.name,
          quantity:  item.quantity,
          unitPrice: String(item.unitPrice.toFixed(2)),
          notes:     item.comments ?? null,
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
