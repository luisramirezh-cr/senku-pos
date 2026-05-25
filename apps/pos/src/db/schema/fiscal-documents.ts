import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sales } from './sales'

export const fiscalDocuments = pgTable('fiscal_documents', {
  id:               uuid('id').primaryKey().defaultRandom(),
  businessId:       uuid('business_id').notNull(),
  saleId:           uuid('sale_id').references(() => sales.id),
  docType:          text('doc_type').notNull().default('FE'), // 'FE' | 'TE'
  consecutive:      text('consecutive').notNull(),
  accessKey:        text('access_key'),             // 49-char clave de acceso (CR)
  status:           text('status').notNull().default('pending'), // 'pending' | 'submitted' | 'accepted' | 'rejected' | 'error'
  trackId:          text('track_id'),               // Hacienda trackId
  xmlContent:       text('xml_content'),            // signed XML
  providerResponse: text('provider_response'),      // raw Hacienda response JSON
  errorMessage:     text('error_message'),
  submittedAt:      timestamp('submitted_at', { withTimezone: true }),
  acknowledgedAt:   timestamp('acknowledged_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('fiscal_docs_business_id_idx').on(t.businessId),
  index('fiscal_docs_sale_id_idx').on(t.saleId),
])

export type FiscalDocument = typeof fiscalDocuments.$inferSelect
export type NewFiscalDocument = typeof fiscalDocuments.$inferInsert
