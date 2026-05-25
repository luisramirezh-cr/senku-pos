# Senku POS — Plan B: Restaurant Mode (Comandeo + KDS + Modifiers)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full restaurant mode — Comandeo two-phase flow (floor plan + order entry), channel picker (Mesa/Para llevar/Delivery), KDS kitchen display, and modifier system — activated only when `hasTableManagement === true`.

**Architecture:** Three new DB tables: `restaurant_tables` (floor layout), `orders` (table/channel order lifecycle), `order_items` (per item with modifier notes). Modifiers are free-text notes in V1 (structured modifier system is V2). The `/comandeo` route replaces `/pos` as the landing page when the business has table management. KDS at `/kds` polls orders every 3 seconds for status updates. The channel picker (Mesa/Para llevar/Delivery) determines whether an order has a `tableId` or a sequential identifier. Comandeo requires Plan A (business-settings-context) to be already implemented.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM + pg, TypeScript, Tailwind CSS v3, React 19, useReducer for order state

---

## File Map

**Create:**
- `apps/pos/src/db/schema/restaurant-tables.ts`
- `apps/pos/src/db/schema/orders.ts`
- `apps/pos/src/db/schema/order-items.ts`
- `apps/pos/src/app/api/tables/route.ts`
- `apps/pos/src/app/api/tables/[id]/route.ts`
- `apps/pos/src/app/api/orders/route.ts`
- `apps/pos/src/app/api/orders/[id]/route.ts`
- `apps/pos/src/app/api/orders/[id]/items/route.ts`
- `apps/pos/src/app/(pos)/comandeo/page.tsx`
- `apps/pos/src/app/(pos)/comandeo/[orderId]/page.tsx`
- `apps/pos/src/app/(pos)/kds/page.tsx`
- `apps/pos/src/app/(pos)/comandeo/_components/FloorPlan.tsx`
- `apps/pos/src/app/(pos)/comandeo/_components/TableCard.tsx`
- `apps/pos/src/app/(pos)/comandeo/_components/ChannelPicker.tsx`
- `apps/pos/src/app/(pos)/comandeo/_components/OrderEntry.tsx`
- `apps/pos/src/app/(pos)/kds/_components/KdsCard.tsx`
- `apps/pos/src/app/(pos)/tables/page.tsx`
- `apps/pos/src/app/api/tables/route.ts`

**Modify:**
- `apps/pos/src/db/schema/index.ts` — export new tables
- `apps/pos/src/app/(pos)/pos/_components/Header.tsx` — Mesas nav conditional (already planned in Plan A)

---

### Task 1: Restaurant Tables DB Schema

**Files:**
- Create: `apps/pos/src/db/schema/restaurant-tables.ts`
- Create: `apps/pos/src/db/schema/orders.ts`
- Create: `apps/pos/src/db/schema/order-items.ts`
- Modify: `apps/pos/src/db/schema/index.ts`

- [ ] **Step 1: Create restaurant-tables schema**

```typescript
// apps/pos/src/db/schema/restaurant-tables.ts
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const restaurantTables = pgTable('restaurant_tables', {
  id:         uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull(),
  name:       text('name').notNull(),       // "Mesa 1", "Mesa A"
  zone:       text('zone').notNull().default('Principal'),
  seats:      integer('seats').notNull().default(4),
  status:     text('status').notNull().default('available'), // 'available' | 'occupied' | 'urgent'
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type RestaurantTable = typeof restaurantTables.$inferSelect
export type NewRestaurantTable = typeof restaurantTables.$inferInsert
```

- [ ] **Step 2: Create orders schema**

```typescript
// apps/pos/src/db/schema/orders.ts
import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const orders = pgTable('orders', {
  id:          uuid('id').primaryKey().defaultRandom(),
  businessId:  uuid('business_id').notNull(),
  tableId:     uuid('table_id'),           // null for TAKEOUT / DELIVERY
  channel:     text('channel').notNull().default('DINE_IN'), // 'DINE_IN' | 'TAKEOUT' | 'DELIVERY'
  identifier:  text('identifier'),          // 'Mesa 1' | 'Llevar #003' | 'Delivery #007'
  waiterId:    text('waiter_id').notNull(), // Clerk userId
  status:      text('status').notNull().default('open'), // 'open' | 'sent_to_kitchen' | 'ready' | 'paid' | 'cancelled'
  total:       numeric('total', { precision: 10, scale: 2 }).notNull().default('0'),
  notes:       text('notes'),
  openedAt:    timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt:    timestamp('closed_at', { withTimezone: true }),
})

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
```

- [ ] **Step 3: Create order-items schema**

```typescript
// apps/pos/src/db/schema/order-items.ts
import { integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { orders } from './orders'
import { products } from './products'

export const orderItems = pgTable('order_items', {
  id:          uuid('id').primaryKey().defaultRandom(),
  orderId:     uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId:   uuid('product_id').notNull().references(() => products.id),
  name:        text('name').notNull(),     // snapshot of product name at order time
  quantity:    integer('quantity').notNull().default(1),
  unitPrice:   numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  notes:       text('notes'),              // free-text modifier notes
  status:      text('status').notNull().default('pending'), // 'pending' | 'preparing' | 'ready'
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
```

- [ ] **Step 4: Export from schema index**

In `apps/pos/src/db/schema/index.ts`, add:
```typescript
export * from './restaurant-tables'
export * from './orders'
export * from './order-items'
```

- [ ] **Step 5: Generate + apply migration**

```bash
cd apps/pos && pnpm db:generate && pnpm db:push
```
Expected: `src/db/migrations/0003_*.sql` created and applied.

- [ ] **Step 6: Typecheck**

```bash
pnpm tsc --noEmit
```

---

### Task 2: Tables API

**Files:**
- Create: `apps/pos/src/app/api/tables/route.ts`
- Create: `apps/pos/src/app/api/tables/[id]/route.ts`

- [ ] **Step 1: Create tables collection route**

```typescript
// apps/pos/src/app/api/tables/route.ts
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { restaurantTables } from '@/db/schema'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const rows = await db.select().from(restaurantTables).where(eq(restaurantTables.businessId, businessId))
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as { businessId: string; name: string; zone?: string; seats?: number }
  if (!body.businessId || !body.name) return NextResponse.json({ error: 'businessId and name required' }, { status: 400 })
  const [table] = await db.insert(restaurantTables).values({
    businessId: body.businessId,
    name: body.name,
    zone: body.zone ?? 'Principal',
    seats: body.seats ?? 4,
    status: 'available',
  }).returning()
  return NextResponse.json(table, { status: 201 })
}
```

- [ ] **Step 2: Create table item route**

```typescript
// apps/pos/src/app/api/tables/[id]/route.ts
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { restaurantTables } from '@/db/schema'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json() as Partial<{ name: string; zone: string; seats: number; status: string }>
  const [table] = await db.update(restaurantTables).set(body).where(eq(restaurantTables.id, id)).returning()
  if (!table) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(table)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await db.delete(restaurantTables).where(eq(restaurantTables.id, id))
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm tsc --noEmit
```

---

### Task 3: Orders API

**Files:**
- Create: `apps/pos/src/app/api/orders/route.ts`
- Create: `apps/pos/src/app/api/orders/[id]/route.ts`
- Create: `apps/pos/src/app/api/orders/[id]/items/route.ts`

- [ ] **Step 1: Create orders collection route**

```typescript
// apps/pos/src/app/api/orders/route.ts
import { auth } from '@clerk/nextjs/server'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { orders, orderItems } from '@/db/schema'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const p = req.nextUrl.searchParams
  const businessId = p.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const status = p.get('status')
  const conditions = [eq(orders.businessId, businessId)]
  if (status) conditions.push(eq(orders.status, status))

  const rows = await db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.openedAt)).limit(100)

  // Attach items
  if (rows.length === 0) return NextResponse.json([])
  const orderIds = rows.map((r) => r.id)
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
  const itemsByOrder = items.reduce<Record<string, typeof items>>((acc, item) => {
    if (!acc[item.orderId]) acc[item.orderId] = []
    acc[item.orderId].push(item)
    return acc
  }, {})

  return NextResponse.json(rows.map((r) => ({ ...r, items: itemsByOrder[r.id] ?? [] })))
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as {
    businessId: string; channel: string; tableId?: string; identifier?: string
  }
  if (!body.businessId || !body.channel) return NextResponse.json({ error: 'businessId and channel required' }, { status: 400 })

  const [order] = await db.insert(orders).values({
    businessId: body.businessId,
    channel: body.channel,
    tableId: body.tableId ?? null,
    identifier: body.identifier ?? null,
    waiterId: userId,
    status: 'open',
  }).returning()
  return NextResponse.json(order, { status: 201 })
}
```

- [ ] **Step 2: Create order item route (status update + cancel)**

```typescript
// apps/pos/src/app/api/orders/[id]/route.ts
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

  const [order] = await db
    .update(orders)
    .set({ ...body, updatedAt: new Date(), closedAt: body.status === 'paid' || body.status === 'cancelled' ? new Date() : undefined })
    .where(eq(orders.id, id))
    .returning()

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Free table when order is paid or cancelled
  if ((body.status === 'paid' || body.status === 'cancelled') && order.tableId) {
    await db.update(restaurantTables).set({ status: 'available' }).where(eq(restaurantTables.id, order.tableId))
  }
  // Mark table as occupied when order goes to kitchen
  if (body.status === 'sent_to_kitchen' && order.tableId) {
    await db.update(restaurantTables).set({ status: 'occupied' }).where(eq(restaurantTables.id, order.tableId))
  }

  return NextResponse.json(order)
}
```

- [ ] **Step 3: Create order items sub-route**

```typescript
// apps/pos/src/app/api/orders/[id]/items/route.ts
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { orderItems, products } from '@/db/schema'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: orderId } = await params
  const body = await req.json() as { productId: string; quantity: number; notes?: string }

  const [product] = await db.select().from(products).where(eq(products.id, body.productId)).limit(1)
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const [item] = await db.insert(orderItems).values({
    orderId,
    productId: body.productId,
    name: product.name,
    quantity: body.quantity,
    unitPrice: product.price,
    notes: body.notes ?? null,
    status: 'pending',
  }).returning()

  return NextResponse.json(item, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: orderId } = await params
  const itemId = req.nextUrl.searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })
  await db.delete(orderItems).where(eq(orderItems.id, itemId))
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm tsc --noEmit
```

---

### Task 4: Tables Management Page

**Files:**
- Create: `apps/pos/src/app/(pos)/tables/page.tsx`

This page lets the owner configure their floor plan (add/remove/rename tables). It's reached from Settings, not the main nav.

- [ ] **Step 1: Create tables management page**

```tsx
// apps/pos/src/app/(pos)/tables/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { usePosSession } from '@/context/pos-session-context'
import type { RestaurantTable } from '@/db/schema'

export default function TablesPage() {
  const { activeBusiness } = usePosSession()
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', zone: 'Principal', seats: 4 })
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!activeBusiness?.id) return
    setLoading(true)
    const res = await fetch(`/api/tables?businessId=${activeBusiness.id}`)
    if (res.ok) setTables(await res.json() as RestaurantTable[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [activeBusiness?.id])

  async function createTable() {
    if (!activeBusiness?.id || !form.name.trim()) return
    setSaving(true)
    await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBusiness.id, ...form }),
    })
    setForm({ name: '', zone: 'Principal', seats: 4 })
    await load()
    setSaving(false)
  }

  async function deleteTable(id: string) {
    await fetch(`/api/tables/${id}`, { method: 'DELETE' })
    await load()
  }

  const zones = [...new Set(tables.map((t) => t.zone))]

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-bold text-brand-surface">Gestión de Mesas</h1>

      <div className="mb-6 rounded-xl bg-brand-navy p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand-surface/40">Nueva Mesa</h2>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <label className="mb-1 block text-xs text-brand-surface/50">Nombre</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Mesa 1"
              className="w-full rounded-lg bg-brand-dark/40 px-3 py-2 text-sm text-brand-surface placeholder-brand-surface/20 focus:outline-none focus:ring-1 focus:ring-brand-teal" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-brand-surface/50">Zona</label>
            <input value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
              placeholder="Principal"
              className="w-full rounded-lg bg-brand-dark/40 px-3 py-2 text-sm text-brand-surface placeholder-brand-surface/20 focus:outline-none focus:ring-1 focus:ring-brand-teal" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-brand-surface/50">Asientos</label>
            <input type="number" value={form.seats} onChange={(e) => setForm((f) => ({ ...f, seats: parseInt(e.target.value) || 4 }))}
              className="w-full rounded-lg bg-brand-dark/40 px-3 py-2 text-sm text-brand-surface focus:outline-none focus:ring-1 focus:ring-brand-teal" />
          </div>
        </div>
        <button onClick={createTable} disabled={saving || !form.name.trim()}
          className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-teal/90 disabled:opacity-40">
          {saving ? 'Guardando...' : '+ Agregar mesa'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-brand-surface/40 animate-pulse">Cargando...</p>
      ) : (
        zones.map((zone) => (
          <div key={zone} className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-surface/40">{zone}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {tables.filter((t) => t.zone === zone).map((table) => (
                <div key={table.id} className="flex items-center justify-between rounded-xl bg-brand-navy p-4">
                  <div>
                    <p className="font-semibold text-brand-surface">{table.name}</p>
                    <p className="text-xs text-brand-surface/40">{table.seats} asientos</p>
                  </div>
                  <button onClick={() => void deleteTable(table.id)}
                    className="text-brand-surface/20 transition hover:text-red-400 text-lg">×</button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Tables link in settings page**

In `apps/pos/src/app/(pos)/settings/page.tsx`, add a link to `/tables` at the bottom (before the save button), visible only when `businessType === 'restaurant' && hasTableManagement`:

```tsx
import Link from 'next/link'
// After the fiscal section, before the save button:
{settings.businessType === 'restaurant' && settings.hasTableManagement && (
  <Link href="/tables"
    className="mb-4 flex w-full items-center justify-between rounded-xl bg-brand-navy px-5 py-3 text-sm text-brand-surface transition hover:bg-brand-navy/80">
    <span>Gestión de mesas</span>
    <span className="text-brand-surface/30">→</span>
  </Link>
)}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm tsc --noEmit
```

---

### Task 5: Floor Plan View (Comandeo Fase 1)

**Files:**
- Create: `apps/pos/src/app/(pos)/comandeo/page.tsx`
- Create: `apps/pos/src/app/(pos)/comandeo/_components/TableCard.tsx`
- Create: `apps/pos/src/app/(pos)/comandeo/_components/ChannelPicker.tsx`
- Create: `apps/pos/src/app/(pos)/comandeo/_components/FloorPlan.tsx`

- [ ] **Step 1: Create TableCard component**

```tsx
// apps/pos/src/app/(pos)/comandeo/_components/TableCard.tsx
import type { RestaurantTable } from '@/db/schema'
import type { Order } from '@/db/schema'

interface Props {
  table: RestaurantTable
  activeOrder?: Order & { items: { id: string }[] }
  onClick: () => void
}

const STATUS_COLORS = {
  available: { bg: '#22C55E', chairs: '#86EFAC', label: 'Libre' },
  occupied:  { bg: '#F59E0B', chairs: '#FCD34D', label: 'Ocupada' },
  urgent:    { bg: '#EF4444', chairs: '#FCA5A5', label: 'Urgente' },
}

function ChairDots({ seats, color }: { seats: number; color: string }) {
  const angles = seats <= 2
    ? [270, 90]
    : seats <= 4
    ? [315, 45, 135, 225]
    : [270, 330, 30, 90, 150, 210]
  return (
    <>
      {angles.slice(0, seats).map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const x = 50 + 38 * Math.cos(rad)
        const y = 50 + 38 * Math.sin(rad)
        return <circle key={i} cx={x} cy={y} r={6} fill={color} />
      })}
    </>
  )
}

export function TableCard({ table, activeOrder, onClick }: Props) {
  const colors = STATUS_COLORS[table.status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.available
  const itemCount = activeOrder?.items.length ?? 0

  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-brand-surface/5 transition">
      <svg width={88} height={88} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="32" fill={colors.bg} opacity={0.15} />
        <circle cx="50" cy="50" r="28" fill={colors.bg} />
        <ChairDots seats={Math.min(table.seats, 6)} color={colors.chairs} />
        {itemCount > 0 && (
          <text x="50" y="55" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
            {itemCount}
          </text>
        )}
      </svg>
      <div className="text-center">
        <p className="text-xs font-semibold text-brand-surface">{table.name}</p>
        <p className="text-[10px] text-brand-surface/40">{colors.label}</p>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Create ChannelPicker component**

```tsx
// apps/pos/src/app/(pos)/comandeo/_components/ChannelPicker.tsx
interface Props {
  onSelect: (channel: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY') => void
  onClose: () => void
}

export function ChannelPicker({ onSelect, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-dark/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-t-2xl bg-brand-navy p-6 pb-8">
        <h2 className="mb-5 text-center text-base font-semibold text-brand-surface">Nueva orden</h2>
        <div className="grid gap-3">
          <button onClick={() => onSelect('DINE_IN')}
            className="flex items-center gap-4 rounded-xl bg-brand-dark/40 p-4 text-left transition hover:bg-brand-dark/60">
            <span className="text-2xl">🍽</span>
            <div>
              <p className="font-semibold text-brand-surface">Mesa</p>
              <p className="text-xs text-brand-surface/40">Selecciona una mesa del plano</p>
            </div>
          </button>
          <button onClick={() => onSelect('TAKEOUT')}
            className="flex items-center gap-4 rounded-xl bg-brand-dark/40 p-4 text-left transition hover:bg-brand-dark/60">
            <span className="text-2xl">🥡</span>
            <div>
              <p className="font-semibold text-brand-surface">Para llevar</p>
              <p className="text-xs text-brand-surface/40">Orden sin mesa asignada</p>
            </div>
          </button>
          <button onClick={() => onSelect('DELIVERY')}
            className="flex items-center gap-4 rounded-xl bg-brand-dark/40 p-4 text-left transition hover:bg-brand-dark/60">
            <span className="text-2xl">🛵</span>
            <div>
              <p className="font-semibold text-brand-surface">Delivery</p>
              <p className="text-xs text-brand-surface/40">Orden para entrega a domicilio</p>
            </div>
          </button>
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 text-sm text-brand-surface/40 hover:text-brand-surface">Cancelar</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create Comandeo floor page**

```tsx
// apps/pos/src/app/(pos)/comandeo/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePosSession } from '@/context/pos-session-context'
import type { RestaurantTable, Order } from '@/db/schema'
import { TableCard } from './_components/TableCard'
import { ChannelPicker } from './_components/ChannelPicker'

type OrderWithItems = Order & { items: { id: string }[] }

export default function ComandeoPage() {
  const router = useRouter()
  const { activeBusiness } = usePosSession()
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [openOrders, setOpenOrders] = useState<OrderWithItems[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [pendingChannel, setPendingChannel] = useState<'DINE_IN' | 'TAKEOUT' | 'DELIVERY' | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!activeBusiness?.id) return
    const [tablesRes, ordersRes] = await Promise.all([
      fetch(`/api/tables?businessId=${activeBusiness.id}`),
      fetch(`/api/orders?businessId=${activeBusiness.id}&status=open`),
    ])
    if (tablesRes.ok) setTables(await tablesRes.json() as RestaurantTable[])
    if (ordersRes.ok) setOpenOrders(await ordersRes.json() as OrderWithItems[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), 10000)
    return () => clearInterval(interval)
  }, [activeBusiness?.id])

  async function handleChannelSelect(channel: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY') {
    setShowPicker(false)
    if (channel === 'DINE_IN') {
      setPendingChannel('DINE_IN')
      return
    }
    // For TAKEOUT and DELIVERY, create order immediately
    const count = openOrders.filter((o) => o.channel === channel).length + 1
    const identifier = channel === 'TAKEOUT' ? `Llevar #${String(count).padStart(3, '0')}` : `Delivery #${String(count).padStart(3, '0')}`
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBusiness?.id, channel, identifier }),
    })
    if (res.ok) {
      const order = await res.json() as Order
      router.push(`/comandeo/${order.id}`)
    }
  }

  async function handleTableSelect(table: RestaurantTable) {
    if (pendingChannel !== 'DINE_IN') {
      // Navigate to existing open order for this table
      const existing = openOrders.find((o) => o.tableId === table.id)
      if (existing) { router.push(`/comandeo/${existing.id}`); return }
      return
    }
    // Create new DINE_IN order for this table
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: activeBusiness?.id,
        channel: 'DINE_IN',
        tableId: table.id,
        identifier: table.name,
      }),
    })
    if (res.ok) {
      const order = await res.json() as Order
      router.push(`/comandeo/${order.id}`)
    }
    setPendingChannel(null)
  }

  const zones = [...new Set(tables.map((t) => t.zone))]

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-brand-surface">Plano de Mesas</h1>
        {pendingChannel === 'DINE_IN' ? (
          <div className="flex items-center gap-2">
            <span className="animate-pulse text-xs text-brand-teal">Selecciona una mesa libre</span>
            <button onClick={() => setPendingChannel(null)} className="text-xs text-brand-surface/40 hover:text-brand-surface">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setShowPicker(true)}
            className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-teal/90">
            + Nueva orden
          </button>
        )}
      </div>

      {loading ? (
        <p className="animate-pulse text-sm text-brand-surface/40">Cargando...</p>
      ) : tables.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
          <p className="text-brand-surface/40">No hay mesas configuradas.</p>
          <a href="/tables" className="text-sm text-brand-teal hover:underline">Configurar mesas →</a>
        </div>
      ) : (
        zones.map((zone) => (
          <div key={zone} className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-surface/30">{zone}</p>
            <div className="flex flex-wrap gap-4">
              {tables.filter((t) => t.zone === zone).map((table) => {
                const order = openOrders.find((o) => o.tableId === table.id)
                return (
                  <TableCard
                    key={table.id}
                    table={{
                      ...table,
                      status: order ? (pendingChannel === 'DINE_IN' ? 'available' : 'occupied') : 'available',
                    }}
                    activeOrder={order}
                    onClick={() => void handleTableSelect(table)}
                  />
                )
              })}
            </div>
          </div>
        ))
      )}

      {showPicker && <ChannelPicker onSelect={(ch) => void handleChannelSelect(ch)} onClose={() => setShowPicker(false)} />}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm tsc --noEmit
```

---

### Task 6: Order Entry View (Comandeo Fase 2)

**Files:**
- Create: `apps/pos/src/app/(pos)/comandeo/[orderId]/page.tsx`

This is the full order entry screen: header with order info + back button, left panel (categories + product grid), right panel (order summary with item list, notes input, send to kitchen + cobrar buttons).

- [ ] **Step 1: Create order entry page**

```tsx
// apps/pos/src/app/(pos)/comandeo/[orderId]/page.tsx
'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { formatCRC } from '@/lib/format'
import { usePosSession } from '@/context/pos-session-context'
import type { Product, Order, OrderItem } from '@/db/schema'

type OrderWithItems = Order & { items: OrderItem[] }

export default function OrderEntryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const router = useRouter()
  const { activeBusiness } = usePosSession()
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function loadOrder() {
    const res = await fetch(`/api/orders?businessId=${activeBusiness?.id}&status=open`)
    if (res.ok) {
      const all = await res.json() as OrderWithItems[]
      setOrder(all.find((o) => o.id === orderId) ?? null)
    }
  }

  useEffect(() => {
    if (!activeBusiness?.id) return
    void loadOrder()
    fetch(`/api/products?businessId=${activeBusiness.id}`)
      .then((r) => r.json())
      .then((data) => setProducts(data as Product[]))
  }, [activeBusiness?.id, orderId])

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[]
  const filtered = activeCategory ? products.filter((p) => p.category === activeCategory) : products

  async function addItem(product: Product) {
    await fetch(`/api/orders/${orderId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, quantity: 1 }),
    })
    await loadOrder()
  }

  async function removeItem(itemId: string) {
    await fetch(`/api/orders/${orderId}/items?itemId=${itemId}`, { method: 'DELETE' })
    await loadOrder()
  }

  async function sendToKitchen() {
    setSending(true)
    await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent_to_kitchen' }),
    })
    router.push('/comandeo')
  }

  const orderTotal = order?.items.reduce(
    (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity, 0
  ) ?? 0

  const CHANNEL_LABEL: Record<string, string> = { DINE_IN: order?.identifier ?? 'Mesa', TAKEOUT: order?.identifier ?? 'Para llevar', DELIVERY: order?.identifier ?? 'Delivery' }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left: product picker */}
      <div className="flex flex-1 flex-col overflow-hidden border-r border-brand-surface/5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-surface/5 px-4 py-3">
          <button onClick={() => router.push('/comandeo')} className="text-sm text-brand-surface/50 hover:text-brand-surface">← Piso</button>
          <span className="font-semibold text-brand-surface">{order ? CHANNEL_LABEL[order.channel] : '—'}</span>
          <div className="w-16" />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto p-3 scrollbar-none">
          <button onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${!activeCategory ? 'bg-brand-teal text-brand-dark' : 'bg-brand-dark/40 text-brand-surface/60'}`}>
            Todo
          </button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${activeCategory === cat ? 'bg-brand-teal text-brand-dark' : 'bg-brand-dark/40 text-brand-surface/60'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((product) => (
              <button key={product.id} onClick={() => void addItem(product)}
                className="rounded-xl bg-brand-navy p-3 text-left transition hover:bg-brand-navy/80 active:scale-95">
                <p className="mb-1 text-xs font-semibold leading-snug text-brand-surface">{product.name}</p>
                <p className="font-mono text-xs font-bold text-brand-teal">{formatCRC(parseFloat(product.price))}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: order summary */}
      <div className="flex w-72 shrink-0 flex-col bg-brand-navy">
        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-surface/40">Orden</p>
          {!order?.items.length ? (
            <p className="text-xs text-brand-surface/30">Sin items todavía</p>
          ) : (
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg bg-brand-dark/30 p-2.5">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-brand-surface">{item.name}</p>
                    {item.notes && <p className="text-[10px] italic text-brand-surface/40">{item.notes}</p>}
                    <p className="font-mono text-[10px] text-brand-surface/50">{formatCRC(parseFloat(item.unitPrice))}</p>
                  </div>
                  <button onClick={() => void removeItem(item.id)}
                    className="text-brand-surface/20 hover:text-red-400 text-base leading-none">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-brand-surface/5 p-4">
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-brand-surface/60">Total</span>
            <span className="font-mono font-bold text-brand-surface">{formatCRC(orderTotal)}</span>
          </div>
          <button onClick={() => void sendToKitchen()} disabled={sending || !order?.items.length}
            className="mb-2 w-full rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-brand-dark transition hover:bg-brand-teal/90 disabled:opacity-40">
            {sending ? 'Enviando...' : 'Enviar a cocina →'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm tsc --noEmit
```

---

### Task 7: KDS Kitchen Display

**Files:**
- Create: `apps/pos/src/app/(pos)/kds/page.tsx`
- Create: `apps/pos/src/app/(pos)/kds/_components/KdsCard.tsx`

- [ ] **Step 1: Create KdsCard component**

```tsx
// apps/pos/src/app/(pos)/kds/_components/KdsCard.tsx
import type { Order, OrderItem } from '@/db/schema'

type OrderWithItems = Order & { items: OrderItem[] }

const CHANNEL_ICON: Record<string, string> = { DINE_IN: '🍽', TAKEOUT: '🥡', DELIVERY: '🛵' }
const STATUS_COLOR: Record<string, string> = {
  sent_to_kitchen: '#F59E0B',
  preparing: '#3B82F6',
  ready: '#22C55E',
}

function getElapsedMinutes(openedAt: Date | string): number {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
}

function TimerBadge({ openedAt }: { openedAt: Date | string }) {
  const mins = getElapsedMinutes(openedAt)
  const color = mins < 8 ? '#22C55E' : mins < 15 ? '#F59E0B' : '#EF4444'
  return (
    <span style={{ color, fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
      {mins}min
    </span>
  )
}

interface Props {
  order: OrderWithItems
  onStatusChange: (orderId: string, status: string) => void
}

export function KdsCard({ order, onStatusChange }: Props) {
  const borderColor = STATUS_COLOR[order.status] ?? '#F59E0B'
  const isOverdue = getElapsedMinutes(order.openedAt) > 15

  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm ${isOverdue ? 'ring-2 ring-red-400' : ''}`}
      style={{ borderTop: `4px solid ${borderColor}` }}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{CHANNEL_ICON[order.channel]}</span>
          <span className="font-bold text-gray-900 text-sm">{order.identifier ?? order.channel}</span>
        </div>
        <TimerBadge openedAt={order.openedAt} />
      </div>

      <div className="mb-3 space-y-1.5">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-800">{item.quantity}× {item.name}</span>
              {item.notes && <p className="text-xs italic text-gray-400">{item.notes}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {order.status === 'sent_to_kitchen' && (
          <button onClick={() => onStatusChange(order.id, 'preparing')}
            className="flex-1 rounded-lg bg-blue-100 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-200">
            En preparación
          </button>
        )}
        {(order.status === 'sent_to_kitchen' || order.status === 'preparing') && (
          <button onClick={() => onStatusChange(order.id, 'ready')}
            className="flex-1 rounded-lg bg-green-100 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-200">
            Listo ✓
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create KDS page**

```tsx
// apps/pos/src/app/(pos)/kds/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { usePosSession } from '@/context/pos-session-context'
import type { Order, OrderItem } from '@/db/schema'
import { KdsCard } from './_components/KdsCard'

type OrderWithItems = Order & { items: OrderItem[] }

export default function KdsPage() {
  const { activeBusiness } = usePosSession()
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [lastRefresh, setLastRefresh] = useState(new Date())

  async function load() {
    if (!activeBusiness?.id) return
    const res = await fetch(`/api/orders?businessId=${activeBusiness.id}&status=sent_to_kitchen`)
    if (res.ok) {
      const data = await res.json() as OrderWithItems[]
      // Include 'preparing' status too — fetch both
      const res2 = await fetch(`/api/orders?businessId=${activeBusiness.id}&status=preparing`)
      const data2 = res2.ok ? await res2.json() as OrderWithItems[] : []
      setOrders([...data, ...data2].sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()))
      setLastRefresh(new Date())
    }
  }

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), 3000)
    return () => clearInterval(interval)
  }, [activeBusiness?.id])

  async function handleStatusChange(orderId: string, status: string) {
    await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-100 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Cocina</h1>
        <span className="text-xs text-gray-400">Actualizado {lastRefresh.toLocaleTimeString('es-CR')}</span>
      </div>

      {orders.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-gray-400">Sin pedidos pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {orders.map((order) => (
            <KdsCard
              key={order.id}
              order={order}
              onStatusChange={(id, status) => void handleStatusChange(id, status)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add KDS link to Header**

In `apps/pos/src/app/(pos)/pos/_components/Header.tsx`, conditionally add `{ href: '/kds', label: 'Cocina' }` when `businessType === 'restaurant'`:

```tsx
const { hasTableManagement, businessType } = useBusinessSettings()
const NAV = [
  { href: '/pos', label: 'Terminal' },
  ...(hasTableManagement ? [{ href: '/comandeo', label: 'Mesas' }] : []),
  ...(businessType === 'restaurant' ? [{ href: '/kds', label: 'Cocina' }] : []),
  { href: '/products', label: 'Productos' },
  { href: '/history', label: 'Historial' },
  { href: '/sessions', label: 'Turnos' },
  { href: '/settings', label: 'Ajustes' },
]
```

- [ ] **Step 4: Typecheck**

```bash
pnpm tsc --noEmit
```

---

### Task 8: Final Verification

- [ ] **Step 1: Full typecheck**

```bash
cd apps/pos && pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 2: Build**

```bash
pnpm build
```
Expected: build succeeds, pages listed include `/comandeo`, `/comandeo/[orderId]`, `/kds`, `/tables`.

- [ ] **Step 3: Dev smoke test**

Start dev server and verify:
1. Business with `hasTableManagement=true` shows "Mesas" and "Cocina" in nav
2. `/comandeo` shows floor plan, `+ Nueva orden` opens channel picker
3. Selecting TAKEOUT creates order and navigates to order entry
4. Adding items, clicking "Enviar a cocina" redirects to floor and order appears in `/kds`
5. KDS card shows correct channel icon, timer, and status buttons
