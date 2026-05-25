const IDP_URL = 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token'
const API_URL = 'https://api.comprobanteselectronicos.go.cr/recepcion/v1/recepcion'

const IDP_URL_STAGING = 'https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token'
const API_URL_STAGING = 'https://api.comprobanteselectronicos.go.cr/recepcion-stag/v1/recepcion'

function isStaging(): boolean {
  return process.env.FISCAL_CR_STAGING === 'true' || process.env.DEV_MOCK_SESSION === 'true'
}

export interface HaciendaToken {
  access_token: string
  expires_in: number
}

/**
 * Gets an OAuth 2.0 bearer token from Hacienda's identity provider.
 * Uses Resource Owner Password Credentials flow (client_id=api-prod).
 */
export async function getCrToken(usuario: string, contrasena: string): Promise<HaciendaToken> {
  const clientId = isStaging() ? 'api-stag' : 'api-prod'
  const idpUrl   = isStaging() ? IDP_URL_STAGING : IDP_URL

  const body = new URLSearchParams({
    grant_type:    'password',
    client_id:     clientId,
    username:      usuario,
    password:      contrasena,
  })

  const res = await fetch(idpUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Hacienda IDP error ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json() as Promise<HaciendaToken>
}

export interface SubmitResult {
  trackId: string | null
  raw: string
}

/**
 * Submits a signed XML to Hacienda's reception endpoint.
 * Returns the trackId (ind-clave) from the response.
 * Hacienda accepts asynchronously — the document is processed in the background.
 * Use checkCrStatus() to poll for the final acceptance/rejection.
 */
export async function submitCrXml(opts: {
  accessKey:  string
  issuedAt:   Date
  issuerRnc:  string
  signedXml:  string
  token:      string
}): Promise<SubmitResult> {
  const apiUrl = isStaging() ? API_URL_STAGING : API_URL

  const xmlB64 = Buffer.from(opts.signedXml, 'utf8').toString('base64')

  const payload = {
    clave:   opts.accessKey,
    fecha:   opts.issuedAt.toISOString().replace('Z', '-06:00'),
    emisor: {
      tipoIdentificacion:   '02',
      numeroIdentificacion: opts.issuerRnc.replace(/-/g, ''),
    },
    comprobanteXml:      xmlB64,
    consecutivoReceptor: null,
  }

  const res = await fetch(apiUrl, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${opts.token}`,
    },
    body: JSON.stringify(payload),
  })

  const raw = await res.text()

  if (res.status !== 202) {
    throw new Error(`Hacienda submission error ${res.status}: ${raw.slice(0, 300)}`)
  }

  // Hacienda returns the clave/trackId in Location header or body
  const trackId = res.headers.get('Location')?.split('/').pop() ?? opts.accessKey

  return { trackId, raw }
}

export type CrDocStatus = 'aceptado' | 'rechazado' | 'en_proceso_de_firma' | 'procesando_comprobante' | 'error'

export interface StatusResult {
  status: CrDocStatus
  xml?: string
  messages?: string[]
  raw: string
}

/**
 * Polls Hacienda for the processing status of a submitted document.
 * Returns 'aceptado' or 'rechazado' once Hacienda has processed it.
 * Returns 'procesando_comprobante' while still in the queue.
 */
export async function checkCrStatus(accessKey: string, token: string): Promise<StatusResult> {
  const apiUrl = isStaging() ? API_URL_STAGING : API_URL

  const res = await fetch(`${apiUrl}/${accessKey}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })

  const raw = await res.text()

  if (!res.ok) {
    return { status: 'error', raw, messages: [`HTTP ${res.status}`] }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { status: 'error', raw, messages: ['Invalid JSON response'] }
  }

  const ind = (body['ind-estado'] ?? body['estadoComprobante'] ?? '') as string
  const status = ind as CrDocStatus
  const messages = body['respuesta-xml']
    ? undefined
    : [(body['mensaje'] as string) ?? ''].filter(Boolean)

  return { status, messages, raw }
}
