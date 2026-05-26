import { auth } from '@clerk/nextjs/server'
import { and, eq, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { modifierGroups, modifierOptions, productModifierGroups } from '@/db/schema'

// GET /api/modifiers/product?productId=X  → groups+options linked to this product
export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const productId = req.nextUrl.searchParams.get('productId')
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  const links = await db.select().from(productModifierGroups)
    .where(eq(productModifierGroups.productId, productId))
  if (!links.length) return NextResponse.json([])

  const groupIds = links.map((l) => l.groupId)
  const groups = await db.select().from(modifierGroups).where(inArray(modifierGroups.id, groupIds))
  const options = await db.select().from(modifierOptions).where(inArray(modifierOptions.groupId, groupIds))

  return NextResponse.json(
    groups.map((g) => ({ ...g, options: options.filter((o) => o.groupId === g.id) })),
  )
}

// POST /api/modifiers/product  → link a modifier group to a product
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as { productId: string; groupId: string }
  if (!body.productId || !body.groupId) return NextResponse.json({ error: 'productId and groupId required' }, { status: 400 })

  await db.insert(productModifierGroups).values({ productId: body.productId, groupId: body.groupId })
    .onConflictDoNothing()
  return new NextResponse(null, { status: 204 })
}

// DELETE /api/modifiers/product?productId=X&groupId=Y
export async function DELETE(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const productId = req.nextUrl.searchParams.get('productId')
  const groupId = req.nextUrl.searchParams.get('groupId')
  if (!productId || !groupId) return NextResponse.json({ error: 'productId and groupId required' }, { status: 400 })

  await db.delete(productModifierGroups)
    .where(and(eq(productModifierGroups.productId, productId), eq(productModifierGroups.groupId, groupId)))
  return new NextResponse(null, { status: 204 })
}
