import { index, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const orders = pgTable('orders', {
  id:         uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull(),
  tableId:    uuid('table_id'),
  channel:    text('channel').notNull().default('DINE_IN'), // 'DINE_IN' | 'TAKEOUT' | 'DELIVERY'
  identifier: text('identifier'),
  waiterId:   text('waiter_id').notNull(),
  status:     text('status').notNull().default('open'), // 'open' | 'sent_to_kitchen' | 'preparing' | 'ready' | 'paid' | 'cancelled'
  total:      numeric('total', { precision: 10, scale: 2 }).notNull().default('0'),
  notes:      text('notes'),
  openedAt:   timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt:   timestamp('closed_at', { withTimezone: true }),
}, (t) => [
  index('orders_business_id_idx').on(t.businessId),
  index('orders_business_status_idx').on(t.businessId, t.status),
])

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
