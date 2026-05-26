import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { modifierGroups, modifierOptions, productModifierGroups } from '@/db/schema'
import { assertBusinessAccess } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const denied = await assertBusinessAccess(userId, businessId)
  if (denied) return denied

  const groups = await db.select().from(modifierGroups).where(eq(modifierGroups.businessId, businessId))
  if (!groups.length) return NextResponse.json([])

  const groupIds = groups.map((g) => g.id)
  const { inArray } = await import('drizzle-orm')
  const options = await db.select().from(modifierOptions).where(inArray(modifierOptions.groupId, groupIds))

  return NextResponse.json(
    groups.map((g) => ({ ...g, options: options.filter((o) => o.groupId === g.id) })),
  )
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as {
    businessId: string
    name: string
    required?: boolean
    multiSelect?: boolean
    options: { name: string; priceDelta?: string }[]
  }
  if (!body.businessId || !body.name) return NextResponse.json({ error: 'businessId and name required' }, { status: 400 })
  const denied = await assertBusinessAccess(userId, body.businessId)
  if (denied) return denied

  const [group] = await db.insert(modifierGroups).values({
    businessId: body.businessId,
    name: body.name,
    required: body.required ?? false,
    multiSelect: body.multiSelect ?? false,
  }).returning()

  const opts = body.options?.length
    ? await db.insert(modifierOptions).values(
        body.options.map((o) => ({ groupId: group.id, name: o.name, priceDelta: o.priceDelta ?? '0' })),
      ).returning()
    : []

  return NextResponse.json({ ...group, options: opts }, { status: 201 })
}
