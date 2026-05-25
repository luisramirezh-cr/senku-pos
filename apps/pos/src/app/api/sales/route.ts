import { auth } from '@clerk/nextjs/server'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { sales, saleItems } from '@/db/schema'
import { calcPointsEarned, notifyLoyalty } from '@/lib/root-api'
import { assertBusinessAccess } from '@/lib/api-auth'
import { emitCrFiscal } from '@/lib/fiscal/emit'
import type { SaleItemInput } from './types'

interface CreateSaleBody {
  businessId: string
  items: SaleItemInput[]
  paymentMethod: 'cash' | 'card' | 'sinpe'
  customerId?: string
  customerName?: string
  pointsRedeemed?: number
  discount?: number
  emitFiscal?: boolean
  businessName?: string
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p = req.nextUrl.searchParams
  const businessId = p.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const denied = await assertBusinessAccess(userId, businessId)
  if (denied) return denied

  const from = p.get('from')
  const to = p.get('to')
  const method = p.get('method')

  const conditions = [eq(sales.businessId, businessId)]
  if (from) conditions.push(gte(sales.createdAt, new Date(from)))
  if (to) conditions.push(lte(sales.createdAt, new Date(to)))
  if (method) conditions.push(eq(sales.paymentMethod, method))

  const rows = await db
    .select()
    .from(sales)
    .where(and(...conditions))
    .orderBy(desc(sales.createdAt))
    .limit(100)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as CreateSaleBody
  const {
    businessId, items, paymentMethod,
    customerId, customerName,
    pointsRedeemed = 0, discount = 0,
    emitFiscal = false, businessName,
  } = body

  if (!businessId || !items?.length || !paymentMethod) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  const denied = await assertBusinessAccess(userId, businessId)
  if (denied) return denied

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const total = Math.max(0, subtotal - discount).toFixed(2)
  const pointsEarned = calcPointsEarned(parseFloat(total))

  const [sale] = await db
    .insert(sales)
    .values({
      businessId,
      cashierId: userId,
      customerId: customerId ?? null,
      customerName: customerName ?? null,
      total,
      discount: discount.toFixed(2),
      paymentMethod,
      status: 'completed',
      loyaltyPointsIssued: pointsEarned,
      loyaltyPointsRedeemed: pointsRedeemed,
    })
    .returning()

  await db.insert(saleItems).values(
    items.map((item) => ({
      saleId: sale.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      subtotal: String((item.unitPrice * item.quantity).toFixed(2)),
    })),
  )

  // Decrement stock for products that track it (retail mode)
  await Promise.all(
    items.map((item) =>
      db.execute(
        sql`UPDATE products
            SET stock = GREATEST(0, CAST(stock AS INTEGER) - ${item.quantity})::text
            WHERE id = ${item.productId} AND stock IS NOT NULL`,
      ),
    ),
  )

  // Fiscal emission — non-blocking, failure stored in fiscal_documents, never aborts sale
  if (emitFiscal) {
    emitCrFiscal({
      businessId,
      saleId: sale.id,
      businessName,
      items,
      total: parseFloat(total),
    }).catch(() => {})
  }

  // Loyalty notification — non-blocking, failure doesn't abort sale
  if (customerId) {
    notifyLoyalty({
      customerId,
      businessId,
      saleId: sale.id,
      pointsEarned,
      pointsRedeemed,
      totalAmount: parseFloat(total),
    }).catch(() => {})
  }

  return NextResponse.json({ ...sale, pointsEarned }, { status: 201 })
}
