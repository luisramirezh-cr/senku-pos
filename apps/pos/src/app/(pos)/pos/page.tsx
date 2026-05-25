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

export default function PosPage() {
  const router = useRouter()
  const { activeBusiness, loading: sessionLoading } = usePosSession()
  const { onboardingDone, loading: settingsLoading } = useBusinessSettings()
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [showCobrar, setShowCobrar] = useState(false)

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

  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-4 p-4">
      {/* Left: product catalog */}
      <div className="flex-1 overflow-hidden">
        {productsLoading ? (
          <div className="flex h-full items-center justify-center">
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
