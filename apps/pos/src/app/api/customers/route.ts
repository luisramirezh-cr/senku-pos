import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { getCustomerByPhone } from '@/lib/root-api'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const phone = req.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const customer = await getCustomerByPhone(phone.replace(/\D/g, ''))
  if (!customer) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(customer)
}
