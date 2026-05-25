import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const fiscalSequences = pgTable('fiscal_sequences', {
  id:            uuid('id').primaryKey().defaultRandom(),
  businessId:    uuid('business_id').notNull(),
  docType:       text('doc_type').notNull().default('FE'),
  establishment: text('establishment').notNull().default('001'),
  terminal:      text('terminal').notNull().default('00001'),
  lastSequence:  integer('last_sequence').notNull().default(0),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('fiscal_seq_business_doctype_uidx').on(t.businessId, t.docType),
])

export type FiscalSequence = typeof fiscalSequences.$inferSelect
