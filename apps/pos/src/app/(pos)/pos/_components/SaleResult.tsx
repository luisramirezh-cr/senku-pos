'use client'

import { useRef } from 'react'
import { formatCRC } from '@/lib/format'
import type { CustomerData } from '@/lib/root-api'
import { usePosSession } from '@/context/pos-session-context'
import type { CartItem } from '../_hooks/useCart'
import { Receipt } from './Receipt'

type PaymentMethod = 'cash' | 'card' | 'sinpe'

export interface SaleResultData {
  saleId: string
  total: number
  discount: number
  change: number
  paymentMethod: PaymentMethod
  customer: CustomerData | null
  pointsEarned: number
  pointsRedeemed: number
  items: CartItem[]
  taxRate: number
  taxName: string
  fiscalEnabled: boolean
  businessId: string
}

interface Props {
  result: SaleResultData
  onClose: () => void
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  sinpe: 'SINPE',
}

export function SaleResult({ result, onClose }: Props) {
  const { activeBusiness } = usePosSession()
  const receiptRef = useRef<HTMLDivElement>(null)
  const { saleId, total, change, paymentMethod, customer, pointsEarned, pointsRedeemed } = result
  const newBalance = customer ? customer.loyaltyPoints - pointsRedeemed + pointsEarned : null

  function handlePrint() {
    window.print()
  }

  return (
    <>
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal/20">
          <svg className="h-7 w-7 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-brand-surface">Venta registrada</h2>
        <p className="font-mono text-xs text-brand-surface/30">#{saleId.slice(0, 8).toUpperCase()}</p>
      </div>

      <div className="mb-5 space-y-2 rounded-xl bg-brand-dark/40 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-brand-surface/50">Total cobrado</span>
          <span className="font-mono font-bold text-brand-surface">{formatCRC(total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-brand-surface/50">Método</span>
          <span className="text-brand-surface">{METHOD_LABEL[paymentMethod]}</span>
        </div>
        {paymentMethod === 'cash' && change > 0 && (
          <div className="flex justify-between">
            <span className="text-brand-surface/50">Cambio</span>
            <span className="font-mono font-semibold text-brand-teal">{formatCRC(change)}</span>
          </div>
        )}
      </div>

      {customer && (
        <div className="mb-5 rounded-xl bg-brand-dark/40 p-4 text-sm">
          <p className="mb-2 font-semibold text-brand-surface">{customer.name}</p>
          {pointsRedeemed > 0 && (
            <div className="mb-1 flex justify-between text-brand-surface/60">
              <span>Puntos canjeados</span>
              <span className="font-mono">−{pointsRedeemed}</span>
            </div>
          )}
          <div className="mb-1 flex justify-between text-brand-teal">
            <span>Puntos ganados</span>
            <span className="font-mono">+{pointsEarned}</span>
          </div>
          {newBalance !== null && (
            <div className="flex justify-between border-t border-brand-surface/10 pt-2 text-brand-surface/60">
              <span>Saldo de puntos</span>
              <span className="font-mono font-semibold text-brand-blue">{newBalance.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handlePrint}
          className="rounded-xl border border-brand-navy px-4 py-2.5 text-sm text-brand-surface/60 transition hover:bg-brand-navy hover:text-brand-surface"
        >
          Imprimir
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-brand-dark transition hover:bg-brand-teal/90 active:scale-95"
        >
          Nueva venta
        </button>
      </div>

      {/* Off-screen receipt for printing — must not use display:none */}
      <div ref={receiptRef} className="fixed left-[-9999px] top-0 overflow-hidden">
        <Receipt result={result} businessName={activeBusiness?.name ?? 'Senku POS'} />
      </div>
    </>
  )
}
