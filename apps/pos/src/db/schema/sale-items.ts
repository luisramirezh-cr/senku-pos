import { index, integer, numeric, pgTable, uuid } from 'drizzle-orm/pg-core'
import { sales } from './sales'
import { products } from './products'

export const saleItems = pgTable('sale_items', {
  id:        uuid('id').primaryKey().defaultRandom(),
  saleId:    uuid('sale_id').notNull().references(() => sales.id),
  productId: uuid('product_id').references(() => products.id),
  quantity:  integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal:  numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
}, (t) => [
  index('sale_items_sale_id_idx').on(t.saleId),
])

export type SaleItem = typeof saleItems.$inferSelect
export type NewSaleItem = typeof saleItems.$inferInsert
