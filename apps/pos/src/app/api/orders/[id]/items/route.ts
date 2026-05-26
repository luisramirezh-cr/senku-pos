import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { orderItems, orderItemModifiers, products } from '@/db/schema'

interface SelectedModifier { groupName: string; optionName: string; priceDelta: string }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: orderId } = await params
  const body = await req.json() as {
    productId: string
    quantity: number
    notes?: string
    modifiers?: SelectedModifier[]
  }

  const [product] = await db.select().from(products).where(eq(products.id, body.productId)).limit(1)
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const modifierDelta = (body.modifiers ?? []).reduce((sum, m) => sum + parseFloat(m.priceDelta || '0'), 0)
  const unitPrice = (parseFloat(product.price) + modifierDelta).toFixed(2)

  const result = await db.transaction(async (tx) => {
    const [item] = await tx.insert(orderItems).values({
      orderId,
      productId: body.productId,
      name: product.name,
      quantity: body.quantity,
      unitPrice,
      notes: body.notes ?? null,
      status: 'pending',
    }).returning()

    if (body.modifiers?.length) {
      await tx.insert(orderItemModifiers).values(
        body.modifiers.map((m) => ({
          orderItemId: item.id,
          groupName: m.groupName,
          optionName: m.optionName,
          priceDelta: m.priceDelta,
        })),
      )
    }
    return item
  })

  return NextResponse.json(result, { status: 201 })
}

export async function DELETE(req: NextRequest, { params: _params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const itemId = req.nextUrl.searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })
  await db.delete(orderItems).where(eq(orderItems.id, itemId))
  return new NextResponse(null, { status: 204 })
}
