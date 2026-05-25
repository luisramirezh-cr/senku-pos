import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const restaurantTables = pgTable('restaurant_tables', {
  id:         uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id').notNull(),
  name:       text('name').notNull(),
  zone:       text('zone').notNull().default('Principal'),
  seats:      integer('seats').notNull().default(4),
  status:     text('status').notNull().default('available'), // 'available' | 'occupied' | 'urgent'
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type RestaurantTable = typeof restaurantTables.$inferSelect
export type NewRestaurantTable = typeof restaurantTables.$inferInsert
