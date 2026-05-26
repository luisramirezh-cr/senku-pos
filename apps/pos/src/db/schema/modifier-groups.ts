import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const modifierGroups = pgTable('modifier_groups', {
  id:          uuid('id').primaryKey().defaultRandom(),
  businessId:  uuid('business_id').notNull(),
  name:        text('name').notNull(),
  required:    boolean('required').notNull().default(false),
  multiSelect: boolean('multi_select').notNull().default(false),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ModifierGroup = typeof modifierGroups.$inferSelect
export type NewModifierGroup = typeof modifierGroups.$inferInsert
