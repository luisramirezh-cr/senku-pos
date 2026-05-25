import { NextResponse } from 'next/server'
import { checkPosAccess } from './root-api'

/**
 * Verifies the authenticated user has access to the given businessId.
 * Returns a 403 NextResponse if not allowed, or null if allowed.
 * In DEV_MOCK_SESSION mode, always returns null (allowed).
 */
export async function assertBusinessAccess(
  userId: string,
  businessId: string,
): Promise<NextResponse | null> {
  const { allowed } = await checkPosAccess(userId, businessId)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
