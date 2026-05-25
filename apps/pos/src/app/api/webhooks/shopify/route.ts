import { eq, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { businessSettings, products, saleItems, sales, webhookLog } from '@/db/schema'
import { validateShopifySignature } from '@/lib/webhook-utils'

interface ShopifyLineItem {
  sku: string
  quantity: number
  price: string
  title: string
}

interface ShopifyOrder {
  id: number
  line_items: ShopifyLineItem[]
  total_price: string
  financial_status: string
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature  = req.headers.get('x-shopify-hmac-sha256') ?? ''
  const shopDomain = req.headers.get('x-shopify-shop-domain') ?? ''
  const topic      = req.headers.get('x-shopify-topic') ?? ''

  if (!shopDomain) return NextResponse.json({ error: 'Missing shop domain' }, { status: 400 })

  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.shopifyShopDomain, shopDomain))
    .limit(1)

  if (!settings) return NextResponse.json({ error: 'Shop not found' }, { status: 404 })

  if (!validateShopifySignature(settings.shopifyWebhookSecret ?? '', rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let shopifyOrder: ShopifyOrder
  try {
    shopifyOrder = JSON.parse(rawBody) as ShopifyOrder
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const [log] = await db.insert(webhookLog).values({
    platform:   'shopify',
    businessId: settings.businessId,
    eventType:  topic,
    payload:    rawBody,
    status:     'received',
  }).returning()

  // Only process paid orders/create events
  if (topic !== 'orders/create' || shopifyOrder.financial_status !== 'paid') {
    return NextResponse.json({ ok: true })
  }

  try {
    const total = parseFloat(shopifyOrder.total_price)

    const saleId = await db.transaction(async (tx) => {
      const [sale] = await tx.insert(sales).values({
        businessId:            settings.businessId,
        cashierId:             'shopify',
        total:                 String(total.toFixed(2)),
        discount:              '0',
        paymentMethod:         'card',
        status:                'completed',
        loyaltyPointsIssued:   0,
        loyaltyPointsRedeemed: 0,
      }).returning()

      for (const lineItem of shopifyOrder.line_items) {
        if (!lineItem.sku) continue

        const [product] = await tx
          .select()
          .from(products)
          .where(eq(products.sku, lineItem.sku))
          .limit(1)

        if (!product) continue

        await tx.insert(saleItems).values({
          saleId:    sale.id,
          productId: product.id,
          quantity:  lineItem.quantity,
          unitPrice: lineItem.price,
          subtotal:  String((parseFloat(lineItem.price) * lineItem.quantity).toFixed(2)),
        })

        await tx.execute(
          sql`UPDATE products
              SET stock = GREATEST(0, CAST(stock AS INTEGER) - ${lineItem.quantity})::text
              WHERE id = ${product.id} AND stock IS NOT NULL`,
        )
      }

      return sale.id
    })

    await db.update(webhookLog)
      .set({ status: 'processed' })
      .where(eq(webhookLog.id, log.id))

    return NextResponse.json({ ok: true, saleId })
  } catch (err) {
    await db.update(webhookLog)
      .set({ status: 'error', error: err instanceof Error ? err.message : String(err) })
      .where(eq(webhookLog.id, log.id)).catch(() => {})
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
