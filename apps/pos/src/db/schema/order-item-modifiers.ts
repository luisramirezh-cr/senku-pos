import { numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { orderItems } from './order-items'

export const orderItemModifiers = pgTable('order_item_modifiers', {
  id:          uuid('id').primaryKey().defaultRandom(),
  orderItemId: uuid('order_item_id').notNull().references(() => orderItems.id, { onDelete: 'cascade' }),
  groupName:   text('group_name').notNull(),
  optionName:  text('option_name').notNull(),
  priceDelta:  numeric('price_delta', { precision: 10, scale: 2 }).notNull().default('0'),
})

export type OrderItemModifier = typeof orderItemModifiers.$inferSelect
