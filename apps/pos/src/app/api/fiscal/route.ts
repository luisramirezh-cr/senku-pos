import { auth } from '@clerk/nextjs/server'
import { desc, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { fiscalDocuments } from '@/db/schema'
import { emitCrFiscal } from '@/lib/fiscal/emit'
import { assertBusinessAccess } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const denied = await assertBusinessAccess(userId, businessId)
  if (denied) return denied

  const rows = await db
    .select()
    .from(fiscalDocuments)
    .where(eq(fiscalDocuments.businessId, businessId))
    .orderBy(desc(fiscalDocuments.createdAt))
    .limit(100)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    businessId: string
    saleId: string
    businessName?: string
    items: { productId: string; name?: string; quantity: number; unitPrice: number }[]
    total: number
  }

  const { businessId, saleId, businessName, items, total } = body
  if (!businessId || !saleId || !items?.length) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const docId = await emitCrFiscal({ businessId, saleId, businessName, items, total })
  if (!docId) {
    return NextResponse.json({ error: 'Fiscal not enabled or RNC not configured' }, { status: 422 })
  }

  return NextResponse.json({ docId }, { status: 201 })
}
