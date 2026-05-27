interface TokenCache {
  token: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token
  }

  const clientId = process.env.UBER_EATS_CLIENT_ID
  const clientSecret = process.env.UBER_EATS_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('UBER_EATS_CLIENT_ID / UBER_EATS_CLIENT_SECRET not set')

  const res = await fetch('https://login.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSecret,
      scope:         'eats.order',
    }),
  })

  if (!res.ok) throw new Error(`Uber token error ${res.status}: ${await res.text()}`)

  const data = await res.json() as { access_token: string; expires_in: number }
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return data.access_token
}

export interface UberEatsItem {
  id: string
  title: string
  quantity: number
  price: { unit_price: { amount: number; currency_code: string } }
  special_instructions?: string
}

export interface UberEatsOrder {
  id: string
  store: { id: string }
  items: UberEatsItem[]
  current_state: string
}

export async function fetchOrder(orderId: string): Promise<UberEatsOrder> {
  const token = await getToken()
  const res = await fetch(`https://api.uber.com/v2/eats/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Uber order fetch error ${res.status}: ${await res.text()}`)
  return res.json() as Promise<UberEatsOrder>
}

export async function acceptOrder(orderId: string): Promise<void> {
  const token = await getToken()
  const res = await fetch(`https://api.uber.com/v1/eats/orders/${orderId}/accept_pos_order`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!res.ok && res.status !== 204) throw new Error(`Uber accept error ${res.status}: ${await res.text()}`)
}

export async function denyOrder(orderId: string, explanation: string): Promise<void> {
  const token = await getToken()
  const res = await fetch(`https://api.uber.com/v1/eats/orders/${orderId}/deny_pos_order`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: { explanation, code: 'POS_OFFLINE' } }),
  })
  if (!res.ok && res.status !== 204) throw new Error(`Uber deny error ${res.status}: ${await res.text()}`)
}
