# Senku POS — Plan D: Third-Party Channel Integrations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Senku Gastro to Uber Eats and Pedidos Ya (orders flow into KDS as DELIVERY orders), and Senku Retail to Shopify (online sales auto-decrement POS stock).

**Architecture:** Webhook-first. Each platform posts to a dedicated `/api/webhooks/<platform>` endpoint. Senku validates the signature, maps the payload to an internal `Order` or stock-decrement event, and processes it identically to a POS-originated event. No polling. Platform credentials stored in `business_settings` (new columns). A `webhook_log` table captures raw payloads for debugging and replay.

**Tech Stack:** Next.js API routes, Drizzle ORM, HMAC-SHA256 signature validation, BullMQ (optional for retry queue), existing `orders` + `products` + `saleItems` tables.

**Prerequisites:** Plan B (Comandeo + KDS) must be implemented for Uber Eats / Pedidos Ya. Plan A stock tracking (Task 9) must be implemented for Shopify.

**Partnership notes (operational, not code):**
- **Uber Eats:** Apply at developer.uber.com → Restaurant Integrations. Requires restaurant to be live on the platform. Webhook registration via dashboard. Approval: 2–4 weeks for production.
- **Pedidos Ya:** Partner API access via developer.pedidosya.com. Requires a signed integration agreement. Approval: 1–3 weeks.
- **Shopify:** Shopify Partner account (free) → create a private app → generate webhook subscriptions via Admin API. Available immediately.

---

## File Map

**Create:**
- `apps/pos/src/db/schema/webhook-log.ts`
- `apps/pos/src/app/api/webhooks/uber-eats/route.ts`
- `apps/pos/src/app/api/webhooks/pedidos-ya/route.ts`
- `apps/pos/src/app/api/webhooks/shopify/route.ts`
- `apps/pos/src/lib/webhook-utils.ts`

**Modify:**
- `apps/pos/src/db/schema/index.ts` — export webhook-log
- `apps/pos/src/db/schema/business-settings.ts` — add `uberEatsStoreId`, `pedidosYaStoreId`, `shopifyShopDomain` columns
- `apps/pos/src/app/(pos)/settings/page.tsx` — add integration credential fields per business type
- `apps/pos/src/app/api/settings/route.ts` — include new columns in GET/PUT

---

### Task 1: Webhook Log Schema + Integration Credential Columns

**Files:**
- Create: `apps/pos/src/db/schema/webhook-log.ts`
- Modify: `apps/pos/src/db/schema/business-settings.ts`
- Modify: `apps/pos/src/db/schema/index.ts`

- [ ] **Step 1: Create webhook-log schema**

```typescript
// apps/pos/src/db/schema/webhook-log.ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const webhookLog = pgTable('webhook_log', {
  id:         uuid('id').primaryKey().defaultRandom(),
  platform:   text('platform').notNull(),          // 'uber_eats' | 'pedidos_ya' | 'shopify'
  businessId: uuid('business_id').notNull(),
  eventType:  text('event_type').notNull(),
  payload:    text('payload').notNull(),            // raw JSON string
  status:     text('status').notNull().default('received'), // 'received' | 'processed' | 'error'
  error:      text('error'),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type WebhookLog = typeof webhookLog.$inferSelect
```

- [ ] **Step 2: Add integration columns to business_settings**

In `apps/pos/src/db/schema/business-settings.ts`, add after `fiscalRnc`:
```typescript
  uberEatsStoreId:   text('uber_eats_store_id'),
  pedidosYaStoreId:  text('pedidos_ya_store_id'),
  shopifyShopDomain: text('shopify_shop_domain'),
  shopifyWebhookSecret: text('shopify_webhook_secret'),
```

- [ ] **Step 3: Export from index**
```typescript
export * from './webhook-log'
```

- [ ] **Step 4: Generate + apply migration**
```bash
cd apps/pos && pnpm db:generate && pnpm db:push
```

- [ ] **Step 5: Update settings API to include new columns in GET/PUT**

Add new fields to `apps/pos/src/app/api/settings/route.ts` defaults and body handling.

---

### Task 2: Webhook Validation Utility

**Files:**
- Create: `apps/pos/src/lib/webhook-utils.ts`

- [ ] **Step 1: Create HMAC validation helpers**

```typescript
// apps/pos/src/lib/webhook-utils.ts
import { createHmac, timingSafeEqual } from 'crypto'

export function validateHmacSha256(
  secret: string,
  body: string,
  signature: string,
): boolean {
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('base64')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

// Uber Eats uses X-Uber-Signature-Sha256: sha256=<hex>
export function validateUberEatsSignature(secret: string, body: string, header: string): boolean {
  const sig = header.replace('sha256=', '')
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch {
    return false
  }
}

// Shopify uses X-Shopify-Hmac-SHA256: <base64>
export function validateShopifySignature(secret: string, body: string, header: string): boolean {
  return validateHmacSha256(secret, body, header)
}

// Pedidos Ya uses X-PY-Signature: sha256=<hex>
export function validatePedidosYaSignature(secret: string, body: string, header: string): boolean {
  return validateUberEatsSignature(secret, body, header)
}
```

---

### Task 3: Uber Eats Webhook Handler

**Files:**
- Create: `apps/pos/src/app/api/webhooks/uber-eats/route.ts`

Uber Eats sends `order.notification` events when a new order arrives. Map it to an internal `Order` + `OrderItems` and mark status `sent_to_kitchen` so it appears on KDS immediately.

- [ ] **Step 1: Create Uber Eats webhook route**

```typescript
// apps/pos/src/app/api/webhooks/uber-eats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { businessSettings, orders, orderItems, webhookLog } from '@/db/schema'
import { validateUberEatsSignature } from '@/lib/webhook-utils'

interface UberEatsOrderItem {
  id: string
  title: string
  quantity: number
  price: { unit_price: { amount: number; currency_code: string } }
  special_instructions?: string
}

interface UberEatsOrder {
  id: string
  store: { id: string }
  items: UberEatsOrderItem[]
  estimated_ready_for_pickup_time?: string
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-uber-signature-sha256') ?? ''

  // Find the business by store ID from payload (before signature validation)
  let parsed: { event_type: string; order: UberEatsOrder }
  try {
    parsed = JSON.parse(rawBody) as typeof parsed
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const storeId = parsed.order?.store?.id
  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.uberEatsStoreId, storeId))
    .limit(1)

  if (!settings) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  // Validate signature (secret stored per-business — add uberEatsWebhookSecret column if needed)
  const secret = process.env.UBER_EATS_WEBHOOK_SECRET ?? ''
  if (secret && !validateUberEatsSignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // Log raw webhook
  await db.insert(webhookLog).values({
    platform: 'uber_eats',
    businessId: settings.businessId,
    eventType: parsed.event_type,
    payload: rawBody,
    status: 'received',
  })

  if (parsed.event_type !== 'orders.notification') {
    return NextResponse.json({ ok: true })
  }

  // Create internal order
  const uberOrder = parsed.order
  const identifier = `UE-${uberOrder.id.slice(0, 6).toUpperCase()}`
  const [order] = await db.insert(orders).values({
    businessId: settings.businessId,
    channel: 'DELIVERY',
    identifier,
    waiterId: 'uber_eats',
    status: 'sent_to_kitchen',
  }).returning()

  // Create order items
  await db.insert(orderItems).values(
    uberOrder.items.map((item) => ({
      orderId: order.id,
      productId: item.id,          // Uber item ID — may not match internal productId
      name: item.title,
      quantity: item.quantity,
      unitPrice: String((item.price.unit_price.amount / 100).toFixed(2)),
      notes: item.special_instructions ?? null,
      status: 'pending' as const,
    }))
  )

  await db
    .update(webhookLog)
    .set({ status: 'processed' })
    .where(eq(webhookLog.eventType, parsed.event_type))

  return NextResponse.json({ ok: true, orderId: order.id })
}
```

---

### Task 4: Pedidos Ya Webhook Handler

**Files:**
- Create: `apps/pos/src/app/api/webhooks/pedidos-ya/route.ts`

Same pattern as Uber Eats — maps to DELIVERY order + KDS.

- [ ] **Step 1: Create Pedidos Ya webhook route**

```typescript
// apps/pos/src/app/api/webhooks/pedidos-ya/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
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

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-py-signature') ?? ''

  let parsed: { event: string; order: PyOrder }
  try {
    parsed = JSON.parse(rawBody) as typeof parsed
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const storeId = parsed.order?.restaurantId
  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.pedidosYaStoreId, storeId))
    .limit(1)

  if (!settings) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

  const secret = process.env.PEDIDOS_YA_WEBHOOK_SECRET ?? ''
  if (secret && !validatePedidosYaSignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  await db.insert(webhookLog).values({
    platform: 'pedidos_ya',
    businessId: settings.businessId,
    eventType: parsed.event,
    payload: rawBody,
    status: 'received',
  })

  if (parsed.event !== 'ORDER_PENDING') {
    return NextResponse.json({ ok: true })
  }

  const pyOrder = parsed.order
  const identifier = `PY-${pyOrder.id.slice(0, 6).toUpperCase()}`
  const [order] = await db.insert(orders).values({
    businessId: settings.businessId,
    channel: 'DELIVERY',
    identifier,
    waiterId: 'pedidos_ya',
    status: 'sent_to_kitchen',
  }).returning()

  await db.insert(orderItems).values(
    pyOrder.products.map((item) => ({
      orderId: order.id,
      productId: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice.toFixed(2)),
      notes: item.comments ?? null,
      status: 'pending' as const,
    }))
  )

  return NextResponse.json({ ok: true, orderId: order.id })
}
```

---

### Task 5: Shopify Webhook Handler (Stock Sync)

**Files:**
- Create: `apps/pos/src/app/api/webhooks/shopify/route.ts`

Listens for `orders/create`. For each line item, find the matching Senku product by SKU, decrement stock.

- [ ] **Step 1: Create Shopify webhook route**

```typescript
// apps/pos/src/app/api/webhooks/shopify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { businessSettings, products, saleItems, sales, webhookLog } from '@/db/schema'
import { validateShopifySignature } from '@/lib/webhook-utils'

interface ShopifyLineItem {
  sku: string
  quantity: number
  price: string
  title: string
  variant_id: number
}

interface ShopifyOrder {
  id: number
  shop_id: number
  line_items: ShopifyLineItem[]
  total_price: string
  financial_status: string
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-shopify-hmac-sha256') ?? ''
  const shopDomain = req.headers.get('x-shopify-shop-domain') ?? ''
  const topic = req.headers.get('x-shopify-topic') ?? ''

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

  await db.insert(webhookLog).values({
    platform: 'shopify',
    businessId: settings.businessId,
    eventType: topic,
    payload: rawBody,
    status: 'received',
  })

  if (topic !== 'orders/create' || shopifyOrder.financial_status !== 'paid') {
    return NextResponse.json({ ok: true })
  }

  // Record sale + decrement stock per SKU
  const total = parseFloat(shopifyOrder.total_price)
  const [sale] = await db.insert(sales).values({
    businessId: settings.businessId,
    cashierId: 'shopify',
    total: String(total.toFixed(2)),
    discount: '0',
    paymentMethod: 'card',
    status: 'completed',
    loyaltyPointsIssued: 0,
    loyaltyPointsRedeemed: 0,
  }).returning()

  for (const lineItem of shopifyOrder.line_items) {
    if (!lineItem.sku) continue
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.sku, lineItem.sku))
      .limit(1)

    if (product) {
      await db.insert(saleItems).values({
        saleId: sale.id,
        productId: product.id,
        quantity: lineItem.quantity,
        unitPrice: lineItem.price,
        subtotal: String((parseFloat(lineItem.price) * lineItem.quantity).toFixed(2)),
      })

      // Decrement stock
      await db.execute(
        sql`UPDATE products
            SET stock = GREATEST(0, CAST(stock AS INTEGER) - ${lineItem.quantity})::text
            WHERE id = ${product.id} AND stock IS NOT NULL`
      )
    }
  }

  return NextResponse.json({ ok: true, saleId: sale.id })
}
```

---

### Task 6: Settings UI for Integration Credentials

**Files:**
- Modify: `apps/pos/src/app/(pos)/settings/page.tsx`

Add a section for each integration, visible only when the relevant business type is active.

- [ ] **Step 1: Add Delivery Integrations section (restaurant)**

After the fiscal section, before the save button, add:
```tsx
{settings.businessType === 'restaurant' && (
  <div className="mb-6 rounded-2xl border border-brand-navy bg-brand-navy/30 p-6">
    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-surface/40">Integraciones de delivery</p>
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-brand-surface/50">Uber Eats Store ID</label>
        <input value={uberEatsStoreId} onChange={(e) => setUberEatsStoreId(e.target.value)}
          placeholder="store-uuid-from-uber-dashboard"
          className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-brand-surface/50">Pedidos Ya Restaurant ID</label>
        <input value={pedidosYaStoreId} onChange={(e) => setPedidosYaStoreId(e.target.value)}
          placeholder="py-restaurant-id"
          className={inputCls} />
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: Add Shopify section (retail)**

```tsx
{settings.businessType === 'retail' && (
  <div className="mb-6 rounded-2xl border border-brand-navy bg-brand-navy/30 p-6">
    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-surface/40">Shopify</p>
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-brand-surface/50">Shop domain</label>
        <input value={shopifyShopDomain} onChange={(e) => setShopifyShopDomain(e.target.value)}
          placeholder="tu-tienda.myshopify.com"
          className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-brand-surface/50">Webhook secret</label>
        <input type="password" value={shopifyWebhookSecret} onChange={(e) => setShopifyWebhookSecret(e.target.value)}
          placeholder="shpss_..."
          className={inputCls} />
      </div>
    </div>
    <p className="mt-3 text-xs text-brand-surface/30">
      Endpoint: <code className="font-mono">{process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify</code>
    </p>
  </div>
)}
```

---

### Task 7: Final Verification

- [ ] **Step 1: Typecheck**
```bash
cd apps/pos && pnpm tsc --noEmit
```

- [ ] **Step 2: Build**
```bash
pnpm build
```

- [ ] **Step 3: Manual webhook test (use curl)**

Test Shopify endpoint signature validation:
```bash
# Generate test HMAC
SECRET="test_secret"
PAYLOAD='{"id":1,"shop_id":123,"line_items":[{"sku":"CAF-001","quantity":2,"price":"1500","title":"Café"}],"total_price":"3000","financial_status":"paid"}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)

curl -X POST http://localhost:3000/api/webhooks/shopify \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-SHA256: $SIG" \
  -H "X-Shopify-Shop-Domain: test-store.myshopify.com" \
  -H "X-Shopify-Topic: orders/create" \
  -d "$PAYLOAD"
```
Expected: `{"ok":true,"saleId":"..."}` or `{"error":"Shop not found"}` (before configuring a business).
