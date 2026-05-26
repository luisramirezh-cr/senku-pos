import { pgTable, uuid } from 'drizzle-orm/pg-core'
import { products } from './products'
import { modifierGroups } from './modifier-groups'

export const productModifierGroups = pgTable('product_modifier_groups', {
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  groupId:   uuid('group_id').notNull().references(() => modifierGroups.id, { onDelete: 'cascade' }),
})
