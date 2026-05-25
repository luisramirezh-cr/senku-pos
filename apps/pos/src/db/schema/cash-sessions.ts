import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const cashSessions = pgTable('cash_sessions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  businessId:     uuid('business_id').notNull(),
  cashierId:      text('cashier_id').notNull(),
  openedAt:       timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt:       timestamp('closed_at', { withTimezone: true }),
  openingBalance: numeric('opening_balance', { precision: 10, scale: 2 }).notNull(),
  closingBalance: numeric('closing_balance', { precision: 10, scale: 2 }),
  totalSales:     numeric('total_sales', { precision: 10, scale: 2 }),
  status:         text('status').notNull().default('open'),
})

export type CashSession = typeof cashSessions.$inferSelect
export type NewCashSession = typeof cashSessions.$inferInsert
