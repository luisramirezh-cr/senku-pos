'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePosSession } from '@/context/pos-session-context'
import type { RestaurantTable, Order, OrderItem } from '@/db/schema'
import { TableCard } from './_components/TableCard'
import { ChannelPicker } from './_components/ChannelPicker'

type OrderWithItems = Order & { items: OrderItem[] }

export default function ComandeoPage() {
  const router = useRouter()
  const { activeBusiness } = usePosSession()
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [openOrders, setOpenOrders] = useState<OrderWithItems[]>([])
  const [showPicker, setShowPicker] = useState(false)
  const [pendingChannel, setPendingChannel] = useState<'DINE_IN' | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!activeBusiness?.id) return
    const [tablesRes, ordersRes] = await Promise.all([
      fetch(`/api/tables?businessId=${activeBusiness.id}`),
      fetch(`/api/orders?businessId=${activeBusiness.id}&status=open`),
    ])
    if (tablesRes.ok) setTables(await tablesRes.json() as RestaurantTable[])
    if (ordersRes.ok) setOpenOrders(await ordersRes.json() as OrderWithItems[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), 10000)
    return () => clearInterval(interval)
  }, [activeBusiness?.id])

  async function handleChannelSelect(channel: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY') {
    setShowPicker(false)
    if (channel === 'DINE_IN') {
      setPendingChannel('DINE_IN')
      return
    }
    const count = openOrders.filter((o) => o.channel === channel).length + 1
    const identifier =
      channel === 'TAKEOUT'
        ? `Llevar #${String(count).padStart(3, '0')}`
        : `Delivery #${String(count).padStart(3, '0')}`
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBusiness?.id, channel, identifier }),
    })
    if (res.ok) {
      const order = await res.json() as Order
      router.push(`/comandeo/${order.id}`)
    }
  }

  async function handleTableClick(table: RestaurantTable) {
    if (pendingChannel !== 'DINE_IN') {
      // Navigate to existing open order for this table
      const existing = openOrders.find((o) => o.tableId === table.id)
      if (existing) router.push(`/comandeo/${existing.id}`)
      return
    }
    // Create new DINE_IN order
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: activeBusiness?.id,
        channel: 'DINE_IN',
        tableId: table.id,
        identifier: table.name,
      }),
    })
    if (res.ok) {
      const order = await res.json() as Order
      router.push(`/comandeo/${order.id}`)
    }
    setPendingChannel(null)
  }

  const zones = [...new Set(tables.map((t) => t.zone))]

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-brand-surface">Plano de Mesas</h1>
        {pendingChannel === 'DINE_IN' ? (
          <div className="flex items-center gap-3">
            <span className="animate-pulse text-xs text-brand-teal">Selecciona una mesa libre</span>
            <button
              onClick={() => setPendingChannel(null)}
              className="text-xs text-brand-surface/40 hover:text-brand-surface"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowPicker(true)}
            className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-teal/90"
          >
            + Nueva orden
          </button>
        )}
      </div>

      {loading ? (
        <p className="animate-pulse text-sm text-brand-surface/40">Cargando...</p>
      ) : tables.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
          <p className="text-brand-surface/40">No hay mesas configuradas.</p>
          <a href="/tables" className="text-sm text-brand-teal hover:underline">
            Configurar mesas →
          </a>
        </div>
      ) : (
        zones.map((zone) => (
          <div key={zone} className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-surface/30">{zone}</p>
            <div className="flex flex-wrap gap-4">
              {tables.filter((t) => t.zone === zone).map((table) => {
                const activeOrder = openOrders.find((o) => o.tableId === table.id)
                const displayStatus = activeOrder ? 'occupied' : 'available'
                return (
                  <TableCard
                    key={table.id}
                    table={{ ...table, status: displayStatus }}
                    activeOrder={activeOrder}
                    onClick={() => void handleTableClick(table)}
                  />
                )
              })}
            </div>
          </div>
        ))
      )}

      {showPicker && (
        <ChannelPicker
          onSelect={(ch) => void handleChannelSelect(ch)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
