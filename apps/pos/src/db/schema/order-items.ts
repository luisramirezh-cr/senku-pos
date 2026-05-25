import { index, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { orders } from './orders'
import { products } from './products'

export const orderItems = pgTable('order_items', {
  id:        uuid('id').primaryKey().defaultRandom(),
  orderId:   uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id),
  name:      text('name').notNull(),
  quantity:  integer('quantity').notNull().default(1),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  notes:     text('notes'),
  status:    text('status').notNull().default('pending'), // 'pending' | 'preparing' | 'ready'
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('order_items_order_id_idx').on(t.orderId),
])

export type OrderItem = typeof orderItems.$inferSelect
export type NewOrderItem = typeof orderItems.$inferInsert
