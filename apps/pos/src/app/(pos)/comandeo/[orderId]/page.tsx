'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { formatCRC } from '@/lib/format'
import { usePosSession } from '@/context/pos-session-context'
import type { Product, Order, OrderItem, OrderItemModifier } from '@/db/schema'
import { ModifierPicker } from './_components/ModifierPicker'

type ItemWithModifiers = OrderItem & { modifiers: OrderItemModifier[] }
type OrderWithItems = Order & { items: ItemWithModifiers[] }

interface ModifierGroup {
  id: string
  name: string
  required: boolean
  multiSelect: boolean
  options: { id: string; name: string; priceDelta: string }[]
}

const CHANNEL_LABEL: Record<string, string> = {
  DINE_IN: 'Mesa',
  TAKEOUT: 'Para llevar',
  DELIVERY: 'Delivery',
}

export default function OrderEntryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = use(params)
  const router = useRouter()
  const { activeBusiness } = usePosSession()
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null)
  const [pendingModifiers, setPendingModifiers] = useState<ModifierGroup[]>([])

  async function loadOrder() {
    if (!activeBusiness?.id) return
    const res = await fetch(`/api/orders?businessId=${activeBusiness.id}&status=open`)
    if (res.ok) {
      const all = await res.json() as OrderWithItems[]
      setOrder(all.find((o) => o.id === orderId) ?? null)
    }
  }

  useEffect(() => {
    if (!activeBusiness?.id) return
    void loadOrder()
    fetch(`/api/products?businessId=${activeBusiness.id}`)
      .then((r) => r.json())
      .then((data) => setProducts(data as Product[]))
  }, [activeBusiness?.id, orderId])

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))] as string[]
  const filtered = activeCategory
    ? products.filter((p) => p.category === activeCategory)
    : products.filter((p) => p.isActive)

  async function handleProductTap(product: Product) {
    const res = await fetch(`/api/modifiers/product?productId=${product.id}`)
    const groups: ModifierGroup[] = res.ok ? await res.json() : []
    if (groups.length > 0) {
      setPendingProduct(product)
      setPendingModifiers(groups)
    } else {
      await addItem(product, [], '')
    }
  }

  async function addItem(
    product: Product,
    modifiers: { groupName: string; optionName: string; priceDelta: string }[],
    notes: string,
  ) {
    await fetch(`/api/orders/${orderId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, quantity: 1, modifiers, notes: notes || null }),
    })
    await loadOrder()
  }

  async function removeItem(itemId: string) {
    await fetch(`/api/orders/${orderId}/items?itemId=${itemId}`, { method: 'DELETE' })
    await loadOrder()
  }

  async function sendToKitchen() {
    setSending(true)
    await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent_to_kitchen' }),
    })
    router.push('/comandeo')
  }

  const orderTotal = order?.items.reduce(
    (sum, item) => sum + parseFloat(item.unitPrice) * item.quantity,
    0,
  ) ?? 0

  const headerLabel = order
    ? `${CHANNEL_LABEL[order.channel] ?? order.channel}${order.identifier ? ` · ${order.identifier}` : ''}`
    : '—'

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Left: product picker */}
      <div className="flex flex-1 flex-col overflow-hidden border-r border-brand-surface/5">
        <div className="flex items-center justify-between border-b border-brand-surface/5 px-4 py-3">
          <button
            onClick={() => router.push('/comandeo')}
            className="text-sm text-brand-surface/50 hover:text-brand-surface"
          >
            ← Piso
          </button>
          <span className="font-semibold text-brand-surface">{headerLabel}</span>
          <div className="w-16" />
        </div>

        <div className="flex gap-2 overflow-x-auto p-3">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              !activeCategory ? 'bg-brand-teal text-brand-dark' : 'bg-brand-dark/40 text-brand-surface/60'
            }`}
          >
            Todo
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeCategory === cat ? 'bg-brand-teal text-brand-dark' : 'bg-brand-dark/40 text-brand-surface/60'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => void handleProductTap(product)}
                className="rounded-xl bg-brand-navy p-3 text-left transition hover:bg-brand-navy/80 active:scale-95"
              >
                <p className="mb-1 text-xs font-semibold leading-snug text-brand-surface">{product.name}</p>
                <p className="font-mono text-xs font-bold text-brand-teal">
                  {formatCRC(parseFloat(product.price))}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: order summary */}
      <div className="flex w-72 shrink-0 flex-col bg-brand-navy">
        <div className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-surface/40">Orden</p>
          {!order?.items.length ? (
            <p className="text-xs text-brand-surface/30">Sin items todavía</p>
          ) : (
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="rounded-lg bg-brand-dark/30 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs font-bold text-brand-teal">{item.quantity}×</span>
                        <span className="text-xs font-semibold text-brand-surface">{item.name}</span>
                      </div>
                      {item.modifiers?.map((m, i) => (
                        <p key={i} className="text-[10px] text-brand-surface/50">
                          {m.groupName}: {m.optionName}
                          {parseFloat(m.priceDelta) !== 0 && (
                            <span className="ml-1 text-brand-teal">+{formatCRC(parseFloat(m.priceDelta))}</span>
                          )}
                        </p>
                      ))}
                      {item.notes && (
                        <p className="text-[10px] italic text-brand-surface/40">{item.notes}</p>
                      )}
                      <p className="font-mono text-[10px] text-brand-surface/40">
                        {formatCRC(parseFloat(item.unitPrice))}
                      </p>
                    </div>
                    <button
                      onClick={() => void removeItem(item.id)}
                      className="text-base leading-none text-brand-surface/20 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-brand-surface/5 p-4">
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-brand-surface/60">Total</span>
            <span className="font-mono font-bold text-brand-surface">{formatCRC(orderTotal)}</span>
          </div>
          <button
            onClick={() => void sendToKitchen()}
            disabled={sending || !order?.items.length}
            className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-brand-dark transition hover:bg-brand-teal/90 disabled:opacity-40"
          >
            {sending ? 'Enviando...' : 'Enviar a cocina →'}
          </button>
        </div>
      </div>

      {pendingProduct && (
        <ModifierPicker
          productName={pendingProduct.name}
          productPrice={parseFloat(pendingProduct.price)}
          groups={pendingModifiers}
          onConfirm={(modifiers, notes) => {
            void addItem(pendingProduct, modifiers, notes)
            setPendingProduct(null)
            setPendingModifiers([])
          }}
          onClose={() => {
            setPendingProduct(null)
            setPendingModifiers([])
          }}
        />
      )}
    </div>
  )
}
