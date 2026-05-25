import { createHmac, timingSafeEqual } from 'crypto'

/** Validates base64-encoded HMAC-SHA256 (used by Shopify: X-Shopify-Hmac-SHA256). */
export function validateShopifySignature(secret: string, body: string, header: string): boolean {
  if (!secret || !header) return false
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('base64')
  try {
    return timingSafeEqual(Buffer.from(expected, 'base64'), Buffer.from(header, 'base64'))
  } catch {
    return false
  }
}

/** Validates hex-encoded HMAC-SHA256 (used by Uber Eats: X-Uber-Signature-Sha256: sha256=<hex>). */
export function validateUberEatsSignature(secret: string, body: string, header: string): boolean {
  if (!secret || !header) return false
  const sig = header.startsWith('sha256=') ? header.slice(7) : header
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch {
    return false
  }
}

/** Validates hex-encoded HMAC-SHA256 (Pedidos Ya: X-PY-Signature: sha256=<hex>). */
export const validatePedidosYaSignature = validateUberEatsSignature
