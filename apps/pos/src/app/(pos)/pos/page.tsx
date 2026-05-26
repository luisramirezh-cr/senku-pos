'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePosSession } from '@/context/pos-session-context'
import { useBusinessSettings } from '@/context/business-settings-context'
import type { Product } from '@/db/schema'
import { useCart } from './_hooks/useCart'
import { ProductGrid } from './_components/ProductGrid'
import { CartPanel } from './_components/CartPanel'
import { CobrarModal } from './_components/CobrarModal'
import { CounterPicker } from './_components/CounterPicker'

export default function PosPage() {
  const router = useRouter()
  const { activeBusiness, loading: sessionLoading } = usePosSession()
  const { onboardingDone, hasTableManagement, loading: settingsLoading } = useBusinessSettings()
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [showCobrar, setShowCobrar] = useState(false)
  const [counter, setCounter] = useState<string | null>(null)

  const { items, addItem, removeItem, setQty, clear, total } = useCart()

  useEffect(() => {
    if (!settingsLoading && !onboardingDone) router.replace('/onboarding')
  }, [settingsLoading, onboardingDone, router])

  useEffect(() => {
    if (!activeBusiness?.id) return
    setProductsLoading(true)
    fetch(`/api/products?businessId=${activeBusiness.id}`)
      .then((r) => r.json())
      .then((data) => setProducts(data as Product[]))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false))
  }, [activeBusiness?.id])

  if (sessionLoading || settingsLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="animate-pulse text-sm text-brand-surface/40">Cargando...</span>
      </div>
    )
  }

  // Food court mode: require counter selection before POS
  if (!hasTableManagement && !counter) {
    return <CounterPicker onSelect={setCounter} />
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-4 p-4">
      {/* Left: product catalog */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Counter badge in food court mode */}
        {counter && (
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-brand-teal">
              {counter}
            </span>
            <button
              onClick={() => setCounter(null)}
              className="text-xs text-brand-surface/30 hover:text-brand-surface/60"
            >
              Cambiar caja
            </button>
          </div>
        )}
        {productsLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="animate-pulse text-sm text-brand-surface/40">Cargando productos...</span>
          </div>
        ) : (
          <ProductGrid products={products} onAdd={addItem} />
        )}
      </div>

      {/* Right: cart */}
      <div className="w-80 shrink-0">
        <CartPanel
          items={items}
          total={total}
          onSetQty={setQty}
          onRemove={removeItem}
          onClear={clear}
          onCobrar={() => setShowCobrar(true)}
        />
      </div>

      {showCobrar && (
        <CobrarModal
          items={items}
          subtotal={total}
          businessId={activeBusiness?.id ?? ''}
          counter={counter ?? undefined}
          onSuccess={() => {
            clear()
            setShowCobrar(false)
          }}
          onClose={() => setShowCobrar(false)}
        />
      )}
    </div>
  )
}
