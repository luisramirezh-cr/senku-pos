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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  await db.delete(restaurantTables).where(eq(restaurantTables.id, id))
  return new NextResponse(null, { status: 204 })
}
