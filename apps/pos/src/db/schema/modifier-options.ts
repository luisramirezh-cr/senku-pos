import { numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { modifierGroups } from './modifier-groups'

export const modifierOptions = pgTable('modifier_options', {
  id:         uuid('id').primaryKey().defaultRandom(),
  groupId:    uuid('group_id').notNull().references(() => modifierGroups.id, { onDelete: 'cascade' }),
  name:       text('name').notNull(),
  priceDelta: numeric('price_delta', { precision: 10, scale: 2 }).notNull().default('0'),
})

export type ModifierOption = typeof modifierOptions.$inferSelect
