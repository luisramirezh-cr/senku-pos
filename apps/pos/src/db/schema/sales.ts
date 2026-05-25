import { index, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const sales = pgTable('sales', {
  id:                    uuid('id').primaryKey().defaultRandom(),
  businessId:            uuid('business_id').notNull(),
  cashierId:             text('cashier_id').notNull(),
  customerId:            text('customer_id'),
  customerName:          text('customer_name'),
  total:                 numeric('total', { precision: 10, scale: 2 }).notNull(),
  discount:              numeric('discount', { precision: 10, scale: 2 }).notNull().default('0'),
  paymentMethod:         text('payment_method').notNull(),
  status:                text('status').notNull().default('completed'),
  loyaltyPointsIssued:   integer('loyalty_points_issued').default(0),
  loyaltyPointsRedeemed: integer('loyalty_points_redeemed').default(0),
  createdAt:             timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('sales_business_id_idx').on(t.businessId),
  index('sales_cashier_id_idx').on(t.cashierId),
  index('sales_created_at_idx').on(t.createdAt),
])

export type Sale = typeof sales.$inferSelect
export type NewSale = typeof sales.$inferInsert
