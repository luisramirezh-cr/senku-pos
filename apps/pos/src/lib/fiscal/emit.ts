import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { fiscalDocuments, businessSettings } from '@/db/schema'
import { nextCrSequence } from './sequences'
import { generateCrXml, buildCrAccessKey, buildCrConsecutivo } from './cr-xml'
import { signCrXml } from './cr-sign'
import { getCrToken, submitCrXml, checkCrStatus } from './cr-api'
import type { SaleItemInput } from '@/app/api/sales/types'

export interface EmitFiscalOpts {
  businessId:   string
  saleId:       string
  businessName?: string
  items:         SaleItemInput[]
  total:         number
}

/**
 * Creates and submits a CR Factura Electrónica for a given sale.
 * Non-blocking: errors are stored in fiscal_documents but do NOT abort the sale.
 * Returns the created fiscal_document row id.
 */
export async function emitCrFiscal(opts: EmitFiscalOpts): Promise<string | null> {
  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, opts.businessId))
    .limit(1)

  if (!settings?.fiscalEnabled || !settings.fiscalRnc) return null

  const { consecutive, establishment, terminal } = await nextCrSequence(opts.businessId, 'FE')

  const issuedAt    = new Date()
  const accessKey   = buildCrAccessKey({ issuedAt, rnc: settings.fiscalRnc, establishment, terminal, consecutive })
  const consecutivo = buildCrConsecutivo({ docType: '01', establishment, terminal, consecutive })

  const lines = opts.items.map((item, i) => ({
    lineNumber:  i + 1,
    description: item.name ?? `Producto`,
    quantity:    item.quantity,
    unitPrice:   item.unitPrice,
    taxRate:     settings.taxRate,
  }))

  const xmlRaw = generateCrXml({
    accessKey,
    consecutive: consecutivo,
    issuerRnc:   settings.fiscalRnc,
    issuerName:  opts.businessName ?? 'Senku POS',
    issuedAt,
    lines,
    taxName:     settings.taxName,
  })

  let xmlContent = xmlRaw
  try {
    const { signedXml } = signCrXml(xmlRaw, settings.fiscalCertBase64 ?? undefined, settings.fiscalApiPassword ?? undefined)
    xmlContent = signedXml
  } catch (err) {
    const [doc] = await db.insert(fiscalDocuments).values({
      businessId: opts.businessId, saleId: opts.saleId,
      docType: 'FE', consecutive, accessKey, status: 'error',
      xmlContent: xmlRaw,
      errorMessage: `Error firmando: ${err instanceof Error ? err.message : String(err)}`,
    }).returning()
    return doc.id
  }

  const [doc] = await db.insert(fiscalDocuments).values({
    businessId: opts.businessId, saleId: opts.saleId,
    docType: 'FE', consecutive, accessKey, status: 'pending', xmlContent,
  }).returning()

  // Submit to Hacienda asynchronously — don't await, don't block the sale response
  submitFiscalDoc(doc.id, opts.businessId, accessKey, issuedAt, settings.fiscalRnc, xmlContent,
    settings.fiscalApiUser ?? '', settings.fiscalApiPassword ?? '').catch(() => {})

  return doc.id
}

async function submitFiscalDoc(
  docId: string, businessId: string, accessKey: string, issuedAt: Date,
  issuerRnc: string, signedXml: string, usuario: string, contrasena: string,
): Promise<void> {
  try {
    await db.update(fiscalDocuments).set({ submittedAt: new Date() }).where(eq(fiscalDocuments.id, docId))

    if (process.env.DEV_MOCK_SESSION === 'true') {
      await db.update(fiscalDocuments).set({
        status: 'accepted', trackId: `mock-${Date.now()}`,
        acknowledgedAt: new Date(), providerResponse: JSON.stringify({ mock: true }),
      }).where(eq(fiscalDocuments.id, docId))
      return
    }

    if (!usuario || !contrasena) {
      await db.update(fiscalDocuments).set({
        status: 'error', errorMessage: 'Usuario o contraseña de API no configurados',
      }).where(eq(fiscalDocuments.id, docId))
      return
    }

    const token = await getCrToken(usuario, contrasena)
    const { trackId, raw } = await submitCrXml({ accessKey, issuedAt, issuerRnc, signedXml, token: token.access_token })

    await db.update(fiscalDocuments).set({
      status: 'submitted', trackId, providerResponse: raw,
    }).where(eq(fiscalDocuments.id, docId))

    // Poll Hacienda for final status (3 attempts, 5s apart)
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((r) => setTimeout(r, 5000))
      const statusRes = await checkCrStatus(accessKey, token.access_token)
      if (statusRes.status === 'aceptado' || statusRes.status === 'rechazado') {
        await db.update(fiscalDocuments).set({
          status: statusRes.status === 'aceptado' ? 'accepted' : 'rejected',
          providerResponse: statusRes.raw, acknowledgedAt: new Date(),
          errorMessage: statusRes.messages?.join('; ') ?? null,
        }).where(eq(fiscalDocuments.id, docId))
        return
      }
    }
    // Still pending after polling — will be updated on manual check
  } catch (err) {
    await db.update(fiscalDocuments).set({
      status: 'error',
      errorMessage: err instanceof Error ? err.message : String(err),
    }).where(eq(fiscalDocuments.id, docId)).catch(() => {})
  }
}
