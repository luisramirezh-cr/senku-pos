import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const webhookLog = pgTable('webhook_log', {
  id:         uuid('id').primaryKey().defaultRandom(),
  platform:   text('platform').notNull(),   // 'uber_eats' | 'pedidos_ya' | 'shopify'
  businessId: uuid('business_id').notNull(),
  eventType:  text('event_type').notNull(),
  payload:    text('payload').notNull(),     // raw JSON string
  status:     text('status').notNull().default('received'), // 'received' | 'processed' | 'error'
  error:      text('error'),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type WebhookLog = typeof webhookLog.$inferSelect
