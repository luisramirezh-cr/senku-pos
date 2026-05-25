import { auth } from '@clerk/nextjs/server'
import { eq, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { products, type NewProduct } from '@/db/schema'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.businessId, businessId), eq(products.isActive, true)))
    .orderBy(products.category, products.name)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: NewProduct = await req.json() as NewProduct
  const [created] = await db.insert(products).values(body).returning()
  return NextResponse.json(created, { status: 201 })
}
