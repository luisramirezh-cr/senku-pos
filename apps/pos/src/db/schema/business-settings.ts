import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const businessSettings = pgTable('business_settings', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  businessId:         uuid('business_id').notNull().unique(),
  businessType:       text('business_type').notNull().default('restaurant'),
  hasTableManagement: boolean('has_table_management').notNull().default(false),
  country:            text('country').notNull().default('CR'),
  taxRate:            integer('tax_rate').notNull().default(13),
  taxName:            text('tax_name').notNull().default('IVA'),
  fiscalEnabled:      boolean('fiscal_enabled').notNull().default(false),
  fiscalRnc:          text('fiscal_rnc'),
  fiscalCertBase64:     text('fiscal_cert_base64'),
  fiscalApiUser:        text('fiscal_api_user'),
  fiscalApiPassword:    text('fiscal_api_password'),
  uberEatsStoreId:      text('uber_eats_store_id'),
  pedidosYaStoreId:     text('pedidos_ya_store_id'),
  shopifyShopDomain:    text('shopify_shop_domain'),
  shopifyWebhookSecret: text('shopify_webhook_secret'),
  onboardingDone:     boolean('onboarding_done').notNull().default(false),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type BusinessSettings = typeof businessSettings.$inferSelect
export type NewBusinessSettings = typeof businessSettings.$inferInsert
