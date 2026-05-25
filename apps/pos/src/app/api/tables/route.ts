import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { restaurantTables } from '@/db/schema'
import { assertBusinessAccess } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const denied = await assertBusinessAccess(userId, businessId)
  if (denied) return denied
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
