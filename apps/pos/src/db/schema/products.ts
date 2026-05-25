import { boolean, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const products = pgTable('products', {
  id:          uuid('id').primaryKey().defaultRandom(),
  businessId:  uuid('business_id').notNull(),
  name:        text('name').notNull(),
  description: text('description'),
  price:       numeric('price', { precision: 10, scale: 2 }).notNull(),
  category:    text('category'),
  sku:         text('sku'),
  stock:       text('stock'),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
