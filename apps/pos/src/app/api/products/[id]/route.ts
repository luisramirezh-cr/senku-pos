import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { products, type NewProduct } from '@/db/schema'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const row = await db.query.products.findFirst({ where: (p, { eq }) => eq(p.id, id) })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as Partial<NewProduct>
  const [updated] = await db.update(products).set(body).where(eq(products.id, id)).returning()
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [toggled] = await db
    .update(products)
    .set({ isActive: false })
    .where(eq(products.id, id))
    .returning()
  if (!toggled) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(toggled)
}
