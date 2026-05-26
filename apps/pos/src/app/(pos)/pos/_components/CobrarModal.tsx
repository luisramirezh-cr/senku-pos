'use client'

import { useState, type ChangeEvent, type FormEvent } from 'react'
import { formatCRC } from '@/lib/format'
import { calcDiscount, calcPointsEarned, type CustomerData } from '@/lib/root-api'
import { extractTax } from '@/lib/tax'
import { useBusinessSettings } from '@/context/business-settings-context'
import type { CartItem } from '../_hooks/useCart'
import { SaleResult, type SaleResultData } from './SaleResult'

type PaymentMethod = 'cash' | 'card' | 'sinpe'
type Step = 'customer' | 'payment'

interface Props {
  items: CartItem[]
  subtotal: number
  businessId: string
  counter?: string
  onSuccess: () => void
  onClose: () => void
}

const METHODS: { key: PaymentMethod; label: string; emoji: string }[] = [
  { key: 'cash', label: 'Efectivo', emoji: '💵' },
  { key: 'card', label: 'Tarjeta', emoji: '💳' },
  { key: 'sinpe', label: 'SINPE', emoji: '📱' },
]

export function CobrarModal({ items, subtotal, businessId, counter: _counter, onSuccess, onClose }: Props) {
  const { taxRate, taxName, fiscalEnabled } = useBusinessSettings()

  const [step, setStep] = useState<Step>('customer')
  const [phone, setPhone] = useState('')
  const [customer, setCustomer] = useState<CustomerData | null>(null)
  const [customerLoading, setCustomerLoading] = useState(false)
  const [customerNotFound, setCustomerNotFound] = useState(false)
  const [redeemPoints, setRedeemPoints] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SaleResultData | null>(null)

  const discount = redeemPoints && customer ? calcDiscount(customer.loyaltyPoints) : 0
  const total = Math.max(0, subtotal - discount)
  const pointsRedeemed = redeemPoints && customer ? Math.min(customer.loyaltyPoints, Math.ceil(discount / 5)) : 0
  const change = method === 'cash' && cashReceived ? Math.max(0, parseFloat(cashReceived) - total) : 0
  const canPay = method !== 'cash' || (parseFloat(cashReceived || '0') >= total)

  async function searchCustomer(e: FormEvent) {
    e.preventDefault()
    if (!phone.trim()) return
    setCustomerLoading(true)
    setCustomerNotFound(false)
    setCustomer(null)
    const clean = phone.replace(/\D/g, '')
    const res = await fetch(`/api/customers?phone=${clean}`)
    if (res.ok) {
      const data = await res.json() as CustomerData
      setCustomer(data)
    } else {
      setCustomerNotFound(true)
    }
    setCustomerLoading(false)
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          paymentMethod: method,
          customerId: customer?.id ?? undefined,
          customerName: customer?.name ?? undefined,
          pointsRedeemed,
          discount,
          items: items.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            unitPrice: parseFloat(i.product.price),
          })),
        }),
      })

      if (res.ok) {
        const data = await res.json() as { id: string; loyaltyPointsIssued: number }
        setResult({
          saleId: data.id,
          total,
          discount,
          change,
          paymentMethod: method,
          customer,
          pointsEarned: data.loyaltyPointsIssued ?? calcPointsEarned(total),
          pointsRedeemed,
          items,
          taxRate,
          taxName,
          fiscalEnabled,
          businessId,
        })
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string }
        setError(body.error ?? 'Error al registrar la venta. Intenta de nuevo.')
      }
    } catch {
      setError('No se pudo conectar al servidor. Verifica tu conexión.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !result && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl bg-brand-navy p-6 shadow-2xl">
        {result ? (
          <SaleResult result={result} onClose={() => { onSuccess(); setResult(null) }} />
        ) : step === 'customer' ? (
          <CustomerStep
            phone={phone}
            onPhoneChange={(v) => { setPhone(v); setCustomer(null); setCustomerNotFound(false) }}
            onSearch={searchCustomer}
            loading={customerLoading}
            customer={customer}
            notFound={customerNotFound}
            redeemPoints={redeemPoints}
            onToggleRedeem={() => setRedeemPoints((v) => !v)}
            discount={discount}
            onSkip={() => setStep('payment')}
            onNext={() => setStep('payment')}
          />
        ) : (
          <PaymentStep
            total={total}
            discount={discount}
            subtotal={subtotal}
            taxRate={taxRate}
            taxName={taxName}
            fiscalEnabled={fiscalEnabled}
            method={method}
            onMethodChange={setMethod}
            cashReceived={cashReceived}
            onCashChange={(e: ChangeEvent<HTMLInputElement>) => setCashReceived(e.target.value)}
            change={change}
            canPay={canPay}
            saving={saving}
            error={error}
            onBack={() => setStep('customer')}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </div>
  )
}

// ─── Step 1: Customer ─────────────────────────────────────────────────────────

function CustomerStep({
  phone, onPhoneChange, onSearch, loading,
  customer, notFound, redeemPoints, onToggleRedeem,
  discount, onSkip, onNext,
}: {
  phone: string
  onPhoneChange: (v: string) => void
  onSearch: (e: FormEvent) => void
  loading: boolean
  customer: CustomerData | null
  notFound: boolean
  redeemPoints: boolean
  onToggleRedeem: () => void
  discount: number
  onSkip: () => void
  onNext: () => void
}) {
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-brand-surface">Cliente</h2>
        <span className="text-xs text-brand-surface/30">Paso 1 de 2</span>
      </div>

      <form onSubmit={onSearch} className="mb-4 flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onPhoneChange(e.target.value)}
          placeholder="Teléfono (88888888)"
          className="flex-1 rounded-lg bg-brand-dark/40 px-3 py-2 text-sm text-brand-surface placeholder-brand-surface/20 focus:outline-none focus:ring-1 focus:ring-brand-teal"
        />
        <button
          type="submit"
          disabled={loading || !phone.trim()}
          className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-teal/90 disabled:opacity-40"
        >
          {loading ? '...' : 'Buscar'}
        </button>
      </form>

      {notFound && (
        <p className="mb-4 text-xs text-brand-surface/40">
          No se encontró un cliente con ese número.
        </p>
      )}

      {customer && (
        <div className="mb-4 rounded-xl bg-brand-dark/40 p-4">
          <p className="font-semibold text-brand-surface">{customer.name}</p>
          <p className="text-xs text-brand-surface/50">{customer.phone}</p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-brand-surface/60">Puntos actuales</span>
            <span className="font-mono font-semibold text-brand-blue">{customer.loyaltyPoints.toLocaleString()}</span>
          </div>
          {customer.loyaltyPoints >= 100 && (
            <button
              onClick={onToggleRedeem}
              className={`mt-3 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                redeemPoints
                  ? 'bg-brand-teal/20 text-brand-teal'
                  : 'bg-brand-dark/40 text-brand-surface/60 hover:bg-brand-dark/60'
              }`}
            >
              <span>Canjear {Math.min(customer.loyaltyPoints, Math.ceil(discount / 5))} puntos</span>
              <span className="font-mono font-semibold">−{formatCRC(discount)}</span>
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onSkip}
          className="flex-1 rounded-lg py-2.5 text-sm text-brand-surface/50 transition hover:bg-brand-dark/40 hover:text-brand-surface"
        >
          Sin cliente
        </button>
        <button
          onClick={onNext}
          className="flex-[2] rounded-lg bg-brand-teal py-2.5 text-sm font-bold text-brand-dark transition hover:bg-brand-teal/90"
        >
          Continuar →
        </button>
      </div>
    </>
  )
}

// ─── Step 2: Payment ──────────────────────────────────────────────────────────

function PaymentStep({
  total, discount, subtotal, taxRate, taxName, fiscalEnabled,
  method, onMethodChange, cashReceived, onCashChange,
  change, canPay, saving, error, onBack, onConfirm,
}: {
  total: number
  discount: number
  subtotal: number
  taxRate: number
  taxName: string
  fiscalEnabled: boolean
  method: PaymentMethod
  onMethodChange: (m: PaymentMethod) => void
  cashReceived: string
  onCashChange: (e: ChangeEvent<HTMLInputElement>) => void
  change: number
  canPay: boolean
  saving: boolean
  error: string | null
  onBack: () => void
  onConfirm: () => void
}) {
  const { net, tax } = extractTax(total, taxRate)

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-brand-surface">Cobrar</h2>
        <span className="text-xs text-brand-surface/30">Paso 2 de 2</span>
      </div>

      {/* Total breakdown */}
      <div className="mb-5 rounded-xl bg-brand-dark/40 p-4">
        {discount > 0 && (
          <>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-brand-surface/50">Subtotal</span>
              <span className="font-mono text-brand-surface/50">{formatCRC(subtotal)}</span>
            </div>
            <div className="mb-2 flex justify-between text-sm text-brand-teal">
              <span>Descuento lealtad</span>
              <span className="font-mono">−{formatCRC(discount)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between">
          <span className="text-sm text-brand-surface/60">Total</span>
          <span className="font-mono text-2xl font-bold text-brand-surface">{formatCRC(total)}</span>
        </div>
        <div className="mt-2 border-t border-brand-surface/10 pt-2">
          <div className="flex justify-between text-xs text-brand-surface/40">
            <span>Neto (sin {taxName})</span>
            <span className="font-mono">{formatCRC(net)}</span>
          </div>
          <div className="flex justify-between text-xs text-brand-surface/40">
            <span>{taxName} {taxRate}%</span>
            <span className="font-mono">{formatCRC(tax)}</span>
          </div>
        </div>
        {fiscalEnabled && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-brand-teal/10 px-2 py-1">
            <span className="text-xs text-brand-teal">Factura electrónica activa</span>
          </div>
        )}
      </div>

      {/* Payment method */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {METHODS.map((m) => (
          <button
            key={m.key}
            onClick={() => onMethodChange(m.key)}
            className={`flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-medium transition ${
              method === m.key
                ? 'bg-brand-teal text-brand-dark'
                : 'bg-brand-dark/40 text-brand-surface/60 hover:bg-brand-dark/60'
            }`}
          >
            <span className="text-lg">{m.emoji}</span>
            {m.label}
          </button>
        ))}
      </div>

      {method === 'cash' && (
        <div className="mb-4">
          <label className="mb-1 block text-xs text-brand-surface/50">Recibido</label>
          <input
            type="number"
            value={cashReceived}
            onChange={onCashChange}
            placeholder="0"
            className="w-full rounded-lg bg-brand-dark/40 px-4 py-2.5 font-mono text-lg text-brand-surface placeholder-brand-surface/20 focus:outline-none focus:ring-1 focus:ring-brand-teal"
          />
          {cashReceived && parseFloat(cashReceived) >= total && (
            <p className="mt-1 text-right font-mono text-sm text-brand-teal">
              Cambio: {formatCRC(change)}
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="rounded-lg px-4 py-2.5 text-sm text-brand-surface/50 transition hover:bg-brand-dark/40 hover:text-brand-surface"
        >
          ← Atrás
        </button>
        <button
          onClick={onConfirm}
          disabled={saving || !canPay}
          className="flex-1 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-brand-dark transition hover:bg-brand-teal/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Registrando...' : 'Confirmar venta'}
        </button>
      </div>
    </>
  )
}
