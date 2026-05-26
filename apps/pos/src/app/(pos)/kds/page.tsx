'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePosSession } from '@/context/pos-session-context'
import { useBusinessSettings } from '@/context/business-settings-context'
import type { Order, OrderItem, OrderItemModifier } from '@/db/schema'
import { KdsCard } from './_components/KdsCard'

type ItemWithModifiers = OrderItem & { modifiers: OrderItemModifier[] }
type OrderWithItems = Order & { items: ItemWithModifiers[] }

export default function KdsPage() {
  const { activeBusiness } = usePosSession()
  const { hasTableManagement } = useBusinessSettings()
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [activeCounter, setActiveCounter] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeBusiness?.id) return
    const [r1, r2] = await Promise.all([
      fetch(`/api/orders?businessId=${activeBusiness.id}&status=sent_to_kitchen`),
      fetch(`/api/orders?businessId=${activeBusiness.id}&status=preparing`),
    ])
    const data1 = r1.ok ? await r1.json() as OrderWithItems[] : []
    const data2 = r2.ok ? await r2.json() as OrderWithItems[] : []
    setOrders(
      [...data1, ...data2].sort((a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime()),
    )
    setLastRefresh(new Date())
  }, [activeBusiness?.id])

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), 3000)
    return () => clearInterval(interval)
  }, [load])

  async function handleStatusChange(orderId: string, status: string) {
    await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  // Counter tabs — only in food court (no table management) mode
  const counters = !hasTableManagement
    ? [...new Set(orders.map((o) => o.counter).filter(Boolean))] as string[]
    : []

  const visible = activeCounter
    ? orders.filter((o) => o.counter === activeCounter)
    : orders

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gray-100 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800">Cocina</h1>
        <span className="text-xs text-gray-400">
          Actualizado {lastRefresh.toLocaleTimeString('es-CR')}
        </span>
      </div>

      {/* Counter filter tabs — food court mode only */}
      {counters.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveCounter(null)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              !activeCounter ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Todos ({orders.length})
          </button>
          {counters.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCounter(c)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeCounter === c ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c} ({orders.filter((o) => o.counter === c).length})
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <p className="text-gray-400">Sin pedidos pendientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((order) => (
            <KdsCard
              key={order.id}
              order={order}
              onStatusChange={(id, status) => void handleStatusChange(id, status)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
