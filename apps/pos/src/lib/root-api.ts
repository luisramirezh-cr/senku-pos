const ROOT_API = process.env.ROOT_API_URL ?? 'https://gosenku.com/api/internal'

const headers = {
  Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
  'Content-Type': 'application/json',
}

export interface SessionBusiness {
  id: string
  name: string
  role: string
}

export interface SessionData {
  userId: string
  businesses: SessionBusiness[]
  activeBusiness: SessionBusiness | null
}

export interface CustomerData {
  id: string         // Clerk userId
  name: string
  phone: string
  loyaltyPoints: number
}

// ─── Dev mock ────────────────────────────────────────────────────────────────

function devMockSession(userId: string, activeBusinessId?: string): SessionData {
  const businesses: SessionBusiness[] = [
    {
      id: process.env.DEV_MOCK_BUSINESS_ID ?? 'dev-business-001',
      name: process.env.DEV_MOCK_BUSINESS_NAME ?? 'Negocio Demo',
      role: 'owner',
    },
  ]
  const activeBusiness =
    businesses.find((b) => b.id === activeBusinessId) ?? businesses[0] ?? null
  return { userId, businesses, activeBusiness }
}

function devMockCustomer(phone: string): CustomerData | null {
  const fixtures: Record<string, CustomerData> = {
    '88888888': { id: 'user_mock_001', name: 'Carlos Mora', phone: '88888888', loyaltyPoints: 1250 },
    '77777777': { id: 'user_mock_002', name: 'Ana Jiménez', phone: '77777777', loyaltyPoints: 340 },
    '66666666': { id: 'user_mock_003', name: 'Rodrigo Quesada', phone: '66666666', loyaltyPoints: 0 },
  }
  return fixtures[phone] ?? null
}

// ─── Session ─────────────────────────────────────────────────────────────────

export async function checkPosAccess(userId: string, businessId: string) {
  if (process.env.DEV_MOCK_SESSION === 'true') return { allowed: true }
  const res = await fetch(
    `${ROOT_API}/check-access?userId=${userId}&app=pos&businessId=${businessId}`,
    { headers },
  )
  return res.json() as Promise<{ allowed: boolean; reason?: string }>
}

export async function getSession(userId: string, businessId?: string): Promise<SessionData> {
  if (process.env.DEV_MOCK_SESSION === 'true') return devMockSession(userId, businessId)
  const params = new URLSearchParams({ userId })
  if (businessId) params.set('businessId', businessId)
  const res = await fetch(`${ROOT_API}/session?${params}`, { headers })
  return res.json() as Promise<SessionData>
}

// ─── Customers ───────────────────────────────────────────────────────────────

export async function getCustomerByPhone(phone: string): Promise<CustomerData | null> {
  if (process.env.DEV_MOCK_SESSION === 'true') return devMockCustomer(phone)
  const res = await fetch(`${ROOT_API}/customers?phone=${encodeURIComponent(phone)}`, { headers })
  if (!res.ok) return null
  return res.json() as Promise<CustomerData>
}

// ─── Loyalty (placeholder — endpoint not live yet) ───────────────────────────

export interface LoyaltyPayload {
  customerId: string
  businessId: string
  saleId: string
  pointsEarned: number
  pointsRedeemed: number
  totalAmount: number
}

export async function notifyLoyalty(payload: LoyaltyPayload): Promise<void> {
  if (process.env.DEV_MOCK_SESSION === 'true') {
    console.log('[loyalty mock] transaction:', payload)
    return
  }
  // TODO: replace with real endpoint when loyalty exposes /api/internal/issue-points
  try {
    await fetch(`${ROOT_API}/loyalty/transaction`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  } catch {
    // Non-blocking — loyalty failure should not break the sale
    console.error('[loyalty] notification failed for saleId:', payload.saleId)
  }
}

// ─── Points helpers ───────────────────────────────────────────────────────────

/** 1 point per ₡100 spent (on final amount after discount) */
export function calcPointsEarned(amountCRC: number): number {
  return Math.floor(amountCRC / 100)
}

/** 100 points = ₡500 discount */
export function calcDiscount(points: number): number {
  return Math.floor(points / 100) * 500
}
