// Roles from Clerk publicMetadata — set by gosenku.com webhooks, never in this repo
export type ClerkRole = 'superadmin' | 'business' | 'cashier' | 'customer'

// Membership roles within a business — stored in business_memberships.role
// waiter and kitchen are POS-only extensions (loyalty only uses owner/admin/cashier)
export type MembershipRole = 'owner' | 'admin' | 'cashier' | 'waiter' | 'kitchen'

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING'
export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'PAID' | 'CANCELLED'
export type OrderItemStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'CANCELLED'
export type Channel = 'TABLE' | 'TAKEOUT' | 'DELIVERY'
export type InvoiceStatus = 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONTINGENCY'
export type PaymentMethod = 'CASH' | 'CARD' | 'SINPE' | 'TRANSFER' | 'COURTESY'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  HACIENDA_ERROR: 'HACIENDA_ERROR',
  LOYALTY_SYNC_ERROR: 'LOYALTY_SYNC_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
