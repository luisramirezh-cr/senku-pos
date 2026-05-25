import { auth } from '@clerk/nextjs/server'
import { eq, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { businessSettings } from '@/db/schema'
import { assertBusinessAccess } from '@/lib/api-auth'

const defaults = {
  businessType: 'restaurant',
  hasTableManagement: false,
  country: 'CR',
  taxRate: 13,
  taxName: 'IVA',
  fiscalEnabled: false,
  fiscalRnc: null,
  onboardingDone: false,
  fiscalCredentialsConfigured: false,
  uberEatsStoreId: null,
  pedidosYaStoreId: null,
  shopifyShopDomain: null,
  shopifyConfigured: false,
}

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const denied = await assertBusinessAccess(userId, businessId)
  if (denied) return denied

  const [row] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, businessId))
    .limit(1)

  if (!row) return NextResponse.json({ businessId, ...defaults })

  // Never expose raw credentials to the client
  const { fiscalCertBase64, fiscalApiUser, fiscalApiPassword, shopifyWebhookSecret, ...safe } = row
  return NextResponse.json({
    ...safe,
    fiscalCredentialsConfigured: !!(fiscalCertBase64 && fiscalApiUser && fiscalApiPassword),
    shopifyConfigured: !!(safe.shopifyShopDomain && shopifyWebhookSecret),
  })
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    businessId: string
    businessType: string
    hasTableManagement: boolean
    country: string
    taxRate: number
    taxName: string
    fiscalEnabled: boolean
    fiscalRnc?: string | null
    onboardingDone?: boolean
    fiscalCertBase64?: string | null
    fiscalApiUser?: string | null
    fiscalApiPassword?: string | null
    uberEatsStoreId?: string | null
    pedidosYaStoreId?: string | null
    shopifyShopDomain?: string | null
    shopifyWebhookSecret?: string | null
  }
  if (!body.businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const denied = await assertBusinessAccess(userId, body.businessId)
  if (denied) return denied

  // For sensitive fields omitted from the PUT, keep the existing DB value via column reference.
  // businessSettings.colName in onConflictDoUpdate SET refers to the current row (not excluded).
  const certVal     = body.fiscalCertBase64  != null ? body.fiscalCertBase64  : sql`${businessSettings.fiscalCertBase64}`
  const apiUserVal  = body.fiscalApiUser     != null ? body.fiscalApiUser     : sql`${businessSettings.fiscalApiUser}`
  const apiPassVal  = body.fiscalApiPassword != null ? body.fiscalApiPassword : sql`${businessSettings.fiscalApiPassword}`
  const shopPassVal = body.shopifyWebhookSecret != null ? body.shopifyWebhookSecret : sql`${businessSettings.shopifyWebhookSecret}`

  const [result] = await db
    .insert(businessSettings)
    .values({
      businessId:           body.businessId,
      businessType:         body.businessType,
      hasTableManagement:   body.hasTableManagement,
      country:              body.country,
      taxRate:              body.taxRate,
      taxName:              body.taxName,
      fiscalEnabled:        body.fiscalEnabled,
      fiscalRnc:            body.fiscalRnc ?? null,
      onboardingDone:       body.onboardingDone ?? false,
      fiscalCertBase64:     body.fiscalCertBase64 ?? null,
      fiscalApiUser:        body.fiscalApiUser ?? null,
      fiscalApiPassword:    body.fiscalApiPassword ?? null,
      uberEatsStoreId:      body.uberEatsStoreId ?? null,
      pedidosYaStoreId:     body.pedidosYaStoreId ?? null,
      shopifyShopDomain:    body.shopifyShopDomain ?? null,
      shopifyWebhookSecret: body.shopifyWebhookSecret ?? null,
      updatedAt:            new Date(),
    })
    .onConflictDoUpdate({
      target: businessSettings.businessId,
      set: {
        businessType:         body.businessType,
        hasTableManagement:   body.hasTableManagement,
        country:              body.country,
        taxRate:              body.taxRate,
        taxName:              body.taxName,
        fiscalEnabled:        body.fiscalEnabled,
        fiscalRnc:            body.fiscalRnc ?? null,
        onboardingDone:       body.onboardingDone ?? false,
        fiscalCertBase64:     certVal,
        fiscalApiUser:        apiUserVal,
        fiscalApiPassword:    apiPassVal,
        uberEatsStoreId:      body.uberEatsStoreId ?? null,
        pedidosYaStoreId:     body.pedidosYaStoreId ?? null,
        shopifyShopDomain:    body.shopifyShopDomain ?? null,
        shopifyWebhookSecret: shopPassVal,
        updatedAt:            new Date(),
      },
    })
    .returning()

  // Return without raw credentials
  const { fiscalCertBase64, fiscalApiUser, fiscalApiPassword, shopifyWebhookSecret, ...safe } = result
  return NextResponse.json({
    ...safe,
    fiscalCredentialsConfigured: !!(fiscalCertBase64 && fiscalApiUser && fiscalApiPassword),
    shopifyConfigured: !!(safe.shopifyShopDomain && shopifyWebhookSecret),
  })
}
