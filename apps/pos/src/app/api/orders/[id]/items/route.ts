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

export async function DELETE(req: NextRequest, { params: _params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const itemId = req.nextUrl.searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 })
  await db.delete(orderItems).where(eq(orderItems.id, itemId))
  return new NextResponse(null, { status: 204 })
}
