import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { fiscalDocuments, businessSettings } from '@/db/schema'
import { getCrToken, checkCrStatus } from '@/lib/fiscal/cr-api'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [doc] = await db
    .select()
    .from(fiscalDocuments)
    .where(eq(fiscalDocuments.id, id))
    .limit(1)

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(doc)
}

/** Manually re-polls Hacienda status for a submitted doc. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const [doc] = await db
    .select()
    .from(fiscalDocuments)
    .where(eq(fiscalDocuments.id, id))
    .limit(1)

  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!doc.accessKey) {
    return NextResponse.json({ error: 'No access key' }, { status: 422 })
  }

  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, doc.businessId))
    .limit(1)

  if (!settings?.fiscalApiUser || !settings.fiscalApiPassword) {
    return NextResponse.json({ error: 'API credentials not configured' }, { status: 422 })
  }

  try {
    const token = await getCrToken(settings.fiscalApiUser, settings.fiscalApiPassword)
    const statusRes = await checkCrStatus(doc.accessKey, token.access_token)

    if (statusRes.status === 'aceptado' || statusRes.status === 'rechazado') {
      await db.update(fiscalDocuments).set({
        status: statusRes.status === 'aceptado' ? 'accepted' : 'rejected',
        providerResponse: statusRes.raw,
        acknowledgedAt: new Date(),
        errorMessage: statusRes.messages?.join('; ') ?? null,
      }).where(eq(fiscalDocuments.id, id))
    }

    return NextResponse.json({ status: statusRes.status, messages: statusRes.messages })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
