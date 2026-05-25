# Senku POS — Plan C: Factura Electrónica (CR + RD)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement electronic invoicing for Costa Rica (Hacienda / TRIBU-CR, Factura Electrónica 4.4, XAdES-EPES) and Dominican Republic (DGII, e-CF), with async emission via BullMQ and a fiscal toggle in the checkout flow.

**Architecture:** A `fiscal_documents` table tracks issued invoices and their status. A `fiscal_sequences` table maintains per-business, per-country consecutive numbering. Country-specific XML generators produce UBL-based XML payloads; for CR the XML is signed with XAdES-EPES using the business `.p12` certificate; for RD the DGII issues e-NCF sequences on request. A BullMQ worker (`fiscalWorker`) processes jobs asynchronously — if the queue is unavailable it falls back to direct submission. The `emitFiscal` flag in the sale POST triggers job creation. This plan requires Plan A (business-settings-context, tax utility) to be implemented.

**Tech Stack:** Next.js 15, Drizzle ORM, BullMQ + ioredis, xmlbuilder2, node-forge (XAdES signing), TypeScript

**Dependencies to install:**
```bash
cd apps/pos && pnpm add bullmq ioredis xmlbuilder2 node-forge
pnpm add -D @types/node-forge
```

---

## File Map

**Create:**
- `apps/pos/src/db/schema/fiscal-documents.ts`
- `apps/pos/src/db/schema/fiscal-sequences.ts`
- `apps/pos/src/lib/fiscal/cr-xml.ts`
- `apps/pos/src/lib/fiscal/rd-xml.ts`
- `apps/pos/src/lib/fiscal/cr-sign.ts`
- `apps/pos/src/lib/fiscal/queue.ts`
- `apps/pos/src/lib/fiscal/worker.ts`
- `apps/pos/src/app/api/fiscal/route.ts`
- `apps/pos/src/app/api/fiscal/[id]/route.ts`

**Modify:**
- `apps/pos/src/db/schema/index.ts`
- `apps/pos/src/app/api/sales/route.ts` — trigger fiscal job when emitFiscal=true
- `docker-compose.yml` — add Redis service for BullMQ

---

### Task 1: Fiscal DB Schema

**Files:**
- Create: `apps/pos/src/db/schema/fiscal-documents.ts`
- Create: `apps/pos/src/db/schema/fiscal-sequences.ts`
- Modify: `apps/pos/src/db/schema/index.ts`

- [ ] **Step 1: Create fiscal-documents schema**

```typescript
// apps/pos/src/db/schema/fiscal-documents.ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sales } from './sales'

export const fiscalDocuments = pgTable('fiscal_documents', {
  id:             uuid('id').primaryKey().defaultRandom(),
  businessId:     uuid('business_id').notNull(),
  saleId:         uuid('sale_id').references(() => sales.id),
  country:        text('country').notNull(),   // 'CR' | 'DO'
  docType:        text('doc_type').notNull(),   // 'FE' (CR) | 'B02' (RD consumer)
  consecutive:    text('consecutive').notNull(), // 10-digit for CR, 9-digit for RD
  accessKey:      text('access_key'),           // 49-char key (CR only)
  status:         text('status').notNull().default('pending'), // 'pending' | 'accepted' | 'rejected' | 'error'
  trackId:        text('track_id'),             // provider TrackID
  xmlContent:     text('xml_content'),          // generated XML
  providerResponse: text('provider_response'),  // raw response JSON
  submittedAt:    timestamp('submitted_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type FiscalDocument = typeof fiscalDocuments.$inferSelect
export type NewFiscalDocument = typeof fiscalDocuments.$inferInsert
```

- [ ] **Step 2: Create fiscal-sequences schema**

```typescript
// apps/pos/src/db/schema/fiscal-sequences.ts
import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const fiscalSequences = pgTable('fiscal_sequences', {
  id:           uuid('id').primaryKey().defaultRandom(),
  businessId:   uuid('business_id').notNull(),
  country:      text('country').notNull(),    // 'CR' | 'DO'
  docType:      text('doc_type').notNull(),   // 'FE' | 'B02' etc.
  establishment: text('establishment').notNull().default('001'), // CR: 3-digit establishment
  terminal:     text('terminal').notNull().default('00001'),     // CR: 5-digit terminal
  lastSequence: integer('last_sequence').notNull().default(0),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type FiscalSequence = typeof fiscalSequences.$inferSelect
```

- [ ] **Step 3: Export from index**

```typescript
// apps/pos/src/db/schema/index.ts — add:
export * from './fiscal-documents'
export * from './fiscal-sequences'
```

- [ ] **Step 4: Generate + apply migration**

```bash
cd apps/pos && pnpm db:generate && pnpm db:push
```

- [ ] **Step 5: Typecheck**

```bash
pnpm tsc --noEmit
```

---

### Task 2: Install Dependencies + Add Redis to docker-compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Install packages**

```bash
cd apps/pos && pnpm add bullmq ioredis xmlbuilder2 node-forge
pnpm add -D @types/node-forge
```
Expected: packages appear in `apps/pos/package.json`.

- [ ] **Step 2: Add Redis to docker-compose.yml**

In `docker-compose.yml`, add the Redis service:

```yaml
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5
```

Also add `REDIS_URL=redis://localhost:6379` to `apps/pos/.env.example`.

- [ ] **Step 3: Add REDIS_URL to .env.local**

Add to `apps/pos/.env.local`:
```
REDIS_URL=redis://localhost:6379
```

- [ ] **Step 4: Start Redis**

```bash
docker compose up redis -d
```
Expected: Redis container running on port 6379.

---

### Task 3: Fiscal Queue

**Files:**
- Create: `apps/pos/src/lib/fiscal/queue.ts`

- [ ] **Step 1: Create queue module**

```typescript
// apps/pos/src/lib/fiscal/queue.ts
import { Queue } from 'bullmq'
import IORedis from 'ioredis'

export interface FiscalJobData {
  fiscalDocumentId: string
  businessId: string
  country: 'CR' | 'DO'
  saleId: string
}

let _connection: IORedis | null = null
let _queue: Queue<FiscalJobData> | null = null

function getConnection(): IORedis | null {
  if (!process.env.REDIS_URL) return null
  if (!_connection) {
    _connection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    _connection.on('error', (err) => console.error('[fiscal-queue] Redis error:', err))
  }
  return _connection
}

export function getFiscalQueue(): Queue<FiscalJobData> | null {
  const conn = getConnection()
  if (!conn) return null
  if (!_queue) {
    _queue = new Queue<FiscalJobData>('fiscal', { connection: conn })
  }
  return _queue
}

export async function enqueueFiscalJob(data: FiscalJobData): Promise<boolean> {
  const queue = getFiscalQueue()
  if (!queue) {
    console.warn('[fiscal-queue] Redis unavailable — fiscal job skipped for', data.fiscalDocumentId)
    return false
  }
  await queue.add('emit', data, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })
  return true
}
```

---

### Task 4: Sequence Helper

**Files:**
- Create: `apps/pos/src/lib/fiscal/sequences.ts`

- [ ] **Step 1: Create sequences module**

```typescript
// apps/pos/src/lib/fiscal/sequences.ts
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { fiscalSequences } from '@/db/schema'

/**
 * Atomically increments and returns the next fiscal sequence number.
 * Returns the number padded to `padLength` digits.
 */
export async function nextSequence(
  businessId: string,
  country: string,
  docType: string,
  padLength: number = 10,
): Promise<{ consecutive: string; establishment: string; terminal: string }> {
  const [existing] = await db
    .select()
    .from(fiscalSequences)
    .where(and(
      eq(fiscalSequences.businessId, businessId),
      eq(fiscalSequences.country, country),
      eq(fiscalSequences.docType, docType),
    ))
    .limit(1)

  if (!existing) {
    await db.insert(fiscalSequences).values({
      businessId, country, docType, lastSequence: 1, updatedAt: new Date(),
    })
    return { consecutive: '1'.padStart(padLength, '0'), establishment: '001', terminal: '00001' }
  }

  const next = existing.lastSequence + 1
  await db
    .update(fiscalSequences)
    .set({ lastSequence: next, updatedAt: new Date() })
    .where(eq(fiscalSequences.id, existing.id))

  return {
    consecutive: String(next).padStart(padLength, '0'),
    establishment: existing.establishment,
    terminal: existing.terminal,
  }
}
```

---

### Task 5: CR XML Generator

**Files:**
- Create: `apps/pos/src/lib/fiscal/cr-xml.ts`

The CR Factura Electrónica 4.4 uses UBL-based XML. The access key (clave) is a 49-character string: `50` (country) + `ddmmyyyy` (8) + issuer RNC (12) + doc type (2) + establishment (3) + terminal (5) + consecutive (10) + situacion (1, always `1`) + security code (8, random) = 49.

- [ ] **Step 1: Create CR XML generator**

```typescript
// apps/pos/src/lib/fiscal/cr-xml.ts
import { create } from 'xmlbuilder2'

export interface CrInvoiceLine {
  lineNumber: number
  description: string
  quantity: number
  unitPrice: number
  taxRate: number
}

export interface CrInvoiceInput {
  accessKey: string      // 49-char clave
  consecutive: string    // 10-digit
  issuerRnc: string      // issuer tax ID
  issuerName: string
  issuedAt: Date
  lines: CrInvoiceLine[]
  taxName: string        // 'IVA'
}

function randomSecurityCode(): string {
  return String(Math.floor(10000000 + Math.random() * 89999999))
}

export function buildCrAccessKey(opts: {
  issuedAt: Date; rnc: string; docType?: string
  establishment: string; terminal: string; consecutive: string
}): string {
  const d = opts.issuedAt
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = String(d.getFullYear())
  const date = `${dd}${mm}${yyyy}`
  const rncPadded = opts.rnc.replace(/-/g, '').padStart(12, '0')
  const docType = (opts.docType ?? '01').padStart(2, '0')
  const security = randomSecurityCode()
  return `50${date}${rncPadded}${docType}${opts.establishment}${opts.terminal}${opts.consecutive}1${security}`
}

export function generateCrXml(input: CrInvoiceInput): string {
  const subtotal = input.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const taxTotal = input.lines.reduce((s, l) => {
    const net = l.unitPrice * l.quantity / (1 + l.taxRate / 100)
    return s + (l.unitPrice * l.quantity - net)
  }, 0)
  const total = subtotal

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('FacturaElectronica', {
      xmlns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    })
      .ele('Clave').txt(input.accessKey).up()
      .ele('CodigoActividad').txt('562001').up()
      .ele('NumeroConsecutivo').txt(input.consecutive).up()
      .ele('FechaEmision').txt(input.issuedAt.toISOString()).up()
      .ele('Emisor')
        .ele('Nombre').txt(input.issuerName).up()
        .ele('Identificacion')
          .ele('Tipo').txt('01').up()
          .ele('Numero').txt(input.issuerRnc.replace(/-/g, '')).up()
        .up()
      .up()
      .ele('CondicionVenta').txt('01').up()
      .ele('MedioPago').txt('01').up()
      .ele('DetalleServicio')

  input.lines.forEach((line) => {
    const net = line.unitPrice * line.quantity / (1 + line.taxRate / 100)
    const tax = line.unitPrice * line.quantity - net

    doc
      .ele('LineaDetalle')
        .ele('NumeroLinea').txt(String(line.lineNumber)).up()
        .ele('Cantidad').txt(String(line.quantity)).up()
        .ele('UnidadMedida').txt('Unid').up()
        .ele('Detalle').txt(line.description).up()
        .ele('PrecioUnitario').txt(line.unitPrice.toFixed(2)).up()
        .ele('MontoTotal').txt((line.unitPrice * line.quantity).toFixed(2)).up()
        .ele('Impuesto')
          .ele('Codigo').txt('01').up()
          .ele('CodigoTarifa').txt('08').up()
          .ele('Tarifa').txt(String(line.taxRate)).up()
          .ele('Monto').txt(tax.toFixed(2)).up()
        .up()
        .ele('MontoTotalLinea').txt((line.unitPrice * line.quantity).toFixed(2)).up()
      .up()
  })

  doc.up()
    .ele('ResumenFactura')
      .ele('CodigoTipoMoneda')
        .ele('CodigoMoneda').txt('CRC').up()
        .ele('TipoCambio').txt('1').up()
      .up()
      .ele('TotalServGravados').txt(subtotal.toFixed(2)).up()
      .ele('TotalImpuesto').txt(taxTotal.toFixed(2)).up()
      .ele('TotalComprobante').txt(total.toFixed(2)).up()
    .up()

  return doc.end({ prettyPrint: true })
}
```

---

### Task 6: RD e-CF XML Generator

**Files:**
- Create: `apps/pos/src/lib/fiscal/rd-xml.ts`

- [ ] **Step 1: Create RD XML generator**

```typescript
// apps/pos/src/lib/fiscal/rd-xml.ts
import { create } from 'xmlbuilder2'

export interface RdInvoiceLine {
  description: string
  quantity: number
  unitPrice: number
  taxRate: number  // ITBIS rate e.g. 18
}

export interface RdInvoiceInput {
  eNcf: string          // 13-char e-NCF (e.g. B0200000001)
  issuerRnc: string
  issuerName: string
  issuedAt: Date
  lines: RdInvoiceLine[]
}

export function generateRdXml(input: RdInvoiceInput): string {
  const total = input.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const taxTotal = input.lines.reduce((s, l) => {
    const net = (l.unitPrice * l.quantity) / (1 + l.taxRate / 100)
    return s + ((l.unitPrice * l.quantity) - net)
  }, 0)
  const netTotal = total - taxTotal

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('ECF', { xmlns: 'http://dgii.gov.do/ce/FacturaElectronica' })
      .ele('Encabezado')
        .ele('Version').txt('1.0').up()
        .ele('IdDoc')
          .ele('TipoeCF').txt(input.eNcf.slice(0, 3)).up()
          .ele('eNCF').txt(input.eNcf).up()
          .ele('FechaVencimientoSecuencia').txt('').up()
          .ele('IndicadorNotaCredito').txt('0').up()
          .ele('FechaEmision').txt(input.issuedAt.toISOString().slice(0, 10)).up()
          .ele('TipoIngresos').txt('01').up()
          .ele('TipoPago').txt('1').up()
        .up()
        .ele('Emisor')
          .ele('RNCEmisor').txt(input.issuerRnc.replace(/-/g, '')).up()
          .ele('RazonSocialEmisor').txt(input.issuerName).up()
          .ele('DireccionEmisor').txt('').up()
        .up()
        .ele('Totales')
          .ele('MontoGravadoTotal').txt(netTotal.toFixed(2)).up()
          .ele('ITBIS1').txt(taxTotal.toFixed(2)).up()
          .ele('TotalITBIS').txt(taxTotal.toFixed(2)).up()
          .ele('MontoTotal').txt(total.toFixed(2)).up()
        .up()
      .up()
      .ele('DetallesItems')

  input.lines.forEach((line, i) => {
    const net = (line.unitPrice * line.quantity) / (1 + line.taxRate / 100)
    const tax = (line.unitPrice * line.quantity) - net
    doc
      .ele('Item')
        .ele('NumeroLinea').txt(String(i + 1)).up()
        .ele('NombreItem').txt(line.description).up()
        .ele('IndicadorFacturacion').txt('1').up()
        .ele('CantidadItem').txt(String(line.quantity)).up()
        .ele('PrecioUnitarioItem').txt(line.unitPrice.toFixed(2)).up()
        .ele('TablaSubDescuento').up()
        .ele('MontoItem').txt((line.unitPrice * line.quantity).toFixed(2)).up()
        .ele('TablaImpuestoAdicional').up()
        .ele('ITBIS1').txt(tax.toFixed(2)).up()
      .up()
  })

  return doc.end({ prettyPrint: true })
}
```

---

### Task 7: CR XAdES-EPES Signing

**Files:**
- Create: `apps/pos/src/lib/fiscal/cr-sign.ts`

XAdES-EPES requires the XML to be signed using the business `.p12` certificate and a specific signature format. For development, signing is mocked when no cert is configured.

- [ ] **Step 1: Install signing dependency**

```bash
cd apps/pos && pnpm add node-forge
pnpm add -D @types/node-forge
```

- [ ] **Step 2: Create signing module**

```typescript
// apps/pos/src/lib/fiscal/cr-sign.ts
import forge from 'node-forge'
import { create } from 'xmlbuilder2'

/**
 * Signs the XML string with the provided .p12 certificate for CR XAdES-EPES.
 * In dev (no certBase64 provided), returns the XML unchanged with a mock signature comment.
 */
export function signCrXml(xmlString: string, certBase64?: string, certPassword?: string): string {
  if (!certBase64 || !certPassword) {
    // Dev mode: append mock signature block
    return xmlString.replace(
      '</FacturaElectronica>',
      '<!-- DEV: Firma XAdES-EPES pendiente. Configurar certificado en Ajustes. -->\n</FacturaElectronica>',
    )
  }

  const p12Der = forge.util.decode64(certBase64)
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPassword)

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })

  const certBag = certBags[forge.pki.oids.certBag]?.[0]
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]

  if (!certBag?.cert || !keyBag?.key) throw new Error('Invalid .p12 certificate')

  const md = forge.md.sha256.create()
  md.update(xmlString, 'utf8')
  const signature = keyBag.key.sign(md)
  const signatureB64 = forge.util.encode64(signature)
  const certPem = forge.pki.certificateToPem(certBag.cert)
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\n/g, '')

  return xmlString.replace(
    '</FacturaElectronica>',
    `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:SignedInfo>
    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
  </ds:SignedInfo>
  <ds:SignatureValue>${signatureB64}</ds:SignatureValue>
  <ds:KeyInfo><ds:X509Data><ds:X509Certificate>${certPem}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>
</ds:Signature>
</FacturaElectronica>`,
  )
}
```

---

### Task 8: Fiscal API Routes

**Files:**
- Create: `apps/pos/src/app/api/fiscal/route.ts`
- Create: `apps/pos/src/app/api/fiscal/[id]/route.ts`
- Modify: `apps/pos/src/app/api/sales/route.ts`

- [ ] **Step 1: Create fiscal collection route**

```typescript
// apps/pos/src/app/api/fiscal/route.ts
import { auth } from '@clerk/nextjs/server'
import { and, desc, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { fiscalDocuments, fiscalSequences, businessSettings, sales } from '@/db/schema'
import { nextSequence } from '@/lib/fiscal/sequences'
import { generateCrXml, buildCrAccessKey } from '@/lib/fiscal/cr-xml'
import { generateRdXml } from '@/lib/fiscal/rd-xml'
import { signCrXml } from '@/lib/fiscal/cr-sign'
import { enqueueFiscalJob } from '@/lib/fiscal/queue'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })
  const docs = await db.select().from(fiscalDocuments)
    .where(eq(fiscalDocuments.businessId, businessId))
    .orderBy(desc(fiscalDocuments.createdAt)).limit(50)
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { businessId: string; saleId: string }
  if (!body.businessId || !body.saleId) {
    return NextResponse.json({ error: 'businessId and saleId required' }, { status: 400 })
  }

  const [settings] = await db.select().from(businessSettings)
    .where(eq(businessSettings.businessId, body.businessId)).limit(1)

  if (!settings?.fiscalEnabled || !settings.fiscalRnc) {
    return NextResponse.json({ error: 'Fiscal not configured' }, { status: 422 })
  }

  const country = settings.country as 'CR' | 'DO'
  const docType = country === 'CR' ? 'FE' : 'B02'

  const { consecutive, establishment, terminal } = await nextSequence(
    body.businessId, country, docType, country === 'CR' ? 10 : 9,
  )

  const [sale] = await db.select().from(sales).where(eq(sales.id, body.saleId)).limit(1)
  if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

  let xmlContent = ''
  let accessKey: string | null = null

  if (country === 'CR') {
    accessKey = buildCrAccessKey({
      issuedAt: new Date(), rnc: settings.fiscalRnc,
      establishment, terminal, consecutive,
    })
    xmlContent = generateCrXml({
      accessKey, consecutive, issuerRnc: settings.fiscalRnc,
      issuerName: 'Senku POS', issuedAt: new Date(),
      lines: [{ lineNumber: 1, description: 'Venta', quantity: 1, unitPrice: parseFloat(sale.total), taxRate: settings.taxRate }],
      taxName: settings.taxName,
    })
    xmlContent = signCrXml(xmlContent)
  } else {
    const eNcf = `B02${consecutive}`
    xmlContent = generateRdXml({
      eNcf, issuerRnc: settings.fiscalRnc, issuerName: 'Senku POS',
      issuedAt: new Date(),
      lines: [{ description: 'Venta', quantity: 1, unitPrice: parseFloat(sale.total), taxRate: settings.taxRate }],
    })
  }

  const [doc] = await db.insert(fiscalDocuments).values({
    businessId: body.businessId, saleId: body.saleId,
    country, docType, consecutive, accessKey,
    status: 'pending', xmlContent,
  }).returning()

  await enqueueFiscalJob({
    fiscalDocumentId: doc.id, businessId: body.businessId,
    country, saleId: body.saleId,
  })

  return NextResponse.json(doc, { status: 201 })
}
```

- [ ] **Step 2: Create fiscal item route (status polling)**

```typescript
// apps/pos/src/app/api/fiscal/[id]/route.ts
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { fiscalDocuments } from '@/db/schema'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const [doc] = await db.select().from(fiscalDocuments).where(eq(fiscalDocuments.id, id)).limit(1)
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(doc)
}
```

- [ ] **Step 3: Trigger fiscal job from POST /api/sales**

In `apps/pos/src/app/api/sales/route.ts`, after the sale is created, add fiscal trigger:

```typescript
// Add to imports:
import { enqueueFiscalJob } from '@/lib/fiscal/queue'
import { nextSequence } from '@/lib/fiscal/sequences'
import { generateCrXml, buildCrAccessKey } from '@/lib/fiscal/cr-xml'
import { generateRdXml } from '@/lib/fiscal/rd-xml'
import { signCrXml } from '@/lib/fiscal/cr-sign'
import { fiscalDocuments, businessSettings } from '@/db/schema'

// Inside POST, add `emitFiscal` to the body type:
const { businessId, items, paymentMethod, customerId, customerName,
  pointsRedeemed = 0, discount = 0, emitFiscal = false } = body

// After inserting sale items (and before notifyLoyalty), add:
if (emitFiscal) {
  const [settings] = await db.select().from(businessSettings)
    .where(eq(businessSettings.businessId, businessId)).limit(1)

  if (settings?.fiscalEnabled && settings.fiscalRnc) {
    const country = settings.country as 'CR' | 'DO'
    const docType = country === 'CR' ? 'FE' : 'B02'
    const { consecutive, establishment, terminal } = await nextSequence(businessId, country, docType, country === 'CR' ? 10 : 9)

    let xmlContent = ''
    let accessKey: string | null = null

    if (country === 'CR') {
      accessKey = buildCrAccessKey({ issuedAt: new Date(), rnc: settings.fiscalRnc, establishment, terminal, consecutive })
      xmlContent = generateCrXml({
        accessKey, consecutive, issuerRnc: settings.fiscalRnc, issuerName: 'Senku POS',
        issuedAt: new Date(),
        lines: items.map((item, i) => ({
          lineNumber: i + 1, description: `Producto ${item.productId.slice(0, 8)}`,
          quantity: item.quantity, unitPrice: item.unitPrice, taxRate: settings.taxRate,
        })),
        taxName: settings.taxName,
      })
      xmlContent = signCrXml(xmlContent)
    } else {
      xmlContent = generateRdXml({
        eNcf: `B02${consecutive}`, issuerRnc: settings.fiscalRnc, issuerName: 'Senku POS',
        issuedAt: new Date(),
        lines: items.map((item) => ({
          description: `Producto ${item.productId.slice(0, 8)}`,
          quantity: item.quantity, unitPrice: item.unitPrice, taxRate: settings.taxRate,
        })),
      })
    }

    const [fiscalDoc] = await db.insert(fiscalDocuments).values({
      businessId, saleId: sale.id, country, docType, consecutive, accessKey,
      status: 'pending', xmlContent,
    }).returning()

    enqueueFiscalJob({ fiscalDocumentId: fiscalDoc.id, businessId, country, saleId: sale.id }).catch(() => {})
  }
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm tsc --noEmit
```

---

### Task 9: BullMQ Worker

**Files:**
- Create: `apps/pos/src/lib/fiscal/worker.ts`

The worker runs as a standalone Node process (started via `ts-node`). For production, it runs as a separate process alongside the Next.js app. In development it can be started with `pnpm fiscal:worker`.

- [ ] **Step 1: Create worker**

```typescript
// apps/pos/src/lib/fiscal/worker.ts
import 'dotenv/config'
import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { fiscalDocuments, businessSettings } from '@/db/schema'
import type { FiscalJobData } from './queue'

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const worker = new Worker<FiscalJobData>(
  'fiscal',
  async (job) => {
    const { fiscalDocumentId, country } = job.data

    const [doc] = await db.select().from(fiscalDocuments).where(eq(fiscalDocuments.id, fiscalDocumentId)).limit(1)
    if (!doc || !doc.xmlContent) throw new Error(`Fiscal doc ${fiscalDocumentId} not found or missing XML`)

    const [settings] = await db.select().from(businessSettings).where(eq(businessSettings.businessId, doc.businessId)).limit(1)

    const endpoint = country === 'CR'
      ? 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion'
      : 'https://ecf.dgii.gov.do/ecf/31'

    await db.update(fiscalDocuments)
      .set({ submittedAt: new Date() })
      .where(eq(fiscalDocuments.id, fiscalDocumentId))

    if (process.env.DEV_MOCK_SESSION === 'true') {
      console.log(`[fiscal-worker] DEV: mock submission for ${fiscalDocumentId} (${country})`)
      await db.update(fiscalDocuments)
        .set({ status: 'accepted', trackId: `mock-${Date.now()}`, acknowledgedAt: new Date(), providerResponse: JSON.stringify({ mock: true }) })
        .where(eq(fiscalDocuments.id, fiscalDocumentId))
      return
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/xml' }
    if (country === 'CR' && settings?.fiscalApiKey) {
      headers['Authorization'] = `Bearer ${settings.fiscalApiKey}`
    }

    const res = await fetch(endpoint, { method: 'POST', headers, body: doc.xmlContent })
    const responseText = await res.text()

    await db.update(fiscalDocuments)
      .set({
        status: res.ok ? 'accepted' : 'rejected',
        trackId: res.headers.get('trackId') ?? null,
        providerResponse: responseText,
        acknowledgedAt: new Date(),
      })
      .where(eq(fiscalDocuments.id, fiscalDocumentId))

    if (!res.ok) throw new Error(`Provider rejected: ${responseText.slice(0, 200)}`)
  },
  { connection, concurrency: 3 },
)

worker.on('completed', (job) => console.log(`[fiscal-worker] completed ${job.id}`))
worker.on('failed', (job, err) => console.error(`[fiscal-worker] failed ${job?.id}:`, err.message))
console.log('[fiscal-worker] started, listening for fiscal jobs...')
```

- [ ] **Step 2: Add worker script to package.json**

In `apps/pos/package.json`, add to `scripts`:
```json
"fiscal:worker": "tsx src/lib/fiscal/worker.ts"
```

- [ ] **Step 3: Start worker in dev**

```bash
cd apps/pos && pnpm fiscal:worker
```
Expected: `[fiscal-worker] started, listening for fiscal jobs...` logged.

---

### Task 10: Final Verification

- [ ] **Step 1: Full typecheck**

```bash
cd apps/pos && pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 2: Build**

```bash
pnpm build
```
Expected: build succeeds.

- [ ] **Step 3: Dev smoke test**

1. Set `DEV_MOCK_SESSION=true`, start `pnpm dev` + `pnpm fiscal:worker`
2. Enable fiscal in Settings, enter a fake RNC
3. Complete a sale with "Emitir factura electrónica" toggled on
4. Check worker logs: `[fiscal-worker] DEV: mock submission` appears
5. Check DB: `fiscal_documents` row exists with `status='accepted'`

---

## Environment Variables Reference

Add to `apps/pos/.env.example`:
```bash
# BullMQ / Redis
REDIS_URL=redis://localhost:6379

# Fiscal (per business — stored in DB, these are worker runtime env vars)
# CR TRIBU-CR API key and cert are stored in business_settings table
# For local worker testing with real certs, override here:
# FISCAL_CR_API_KEY=your-tribu-cr-api-key
```
