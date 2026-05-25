'use client'

import { useState, useEffect } from 'react'
import { usePosSession } from '@/context/pos-session-context'
import type { RestaurantTable } from '@/db/schema'

export default function TablesPage() {
  const { activeBusiness } = usePosSession()
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', zone: 'Principal', seats: 4 })
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!activeBusiness?.id) return
    setLoading(true)
    const res = await fetch(`/api/tables?businessId=${activeBusiness.id}`)
    if (res.ok) setTables(await res.json() as RestaurantTable[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [activeBusiness?.id])

  async function createTable() {
    if (!activeBusiness?.id || !form.name.trim()) return
    setSaving(true)
    await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBusiness.id, ...form }),
    })
    setForm({ name: '', zone: 'Principal', seats: 4 })
    await load()
    setSaving(false)
  }

  async function deleteTable(id: string) {
    await fetch(`/api/tables/${id}`, { method: 'DELETE' })
    await load()
  }

  const zones = [...new Set(tables.map((t) => t.zone))]

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-xl font-bold text-brand-surface">Gestión de Mesas</h1>

      <div className="mb-6 rounded-xl bg-brand-navy p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand-surface/40">Nueva Mesa</h2>
        <div className="mb-3 grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs text-brand-surface/50">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Mesa 1"
              className="w-full rounded-lg bg-brand-dark/40 px-3 py-2 text-sm text-brand-surface placeholder-brand-surface/20 focus:outline-none focus:ring-1 focus:ring-brand-teal"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-brand-surface/50">Zona</label>
            <input
              value={form.zone}
              onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
              placeholder="Principal"
              className="w-full rounded-lg bg-brand-dark/40 px-3 py-2 text-sm text-brand-surface placeholder-brand-surface/20 focus:outline-none focus:ring-1 focus:ring-brand-teal"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-brand-surface/50">Asientos</label>
            <input
              type="number"
              value={form.seats}
              onChange={(e) => setForm((f) => ({ ...f, seats: parseInt(e.target.value) || 4 }))}
              className="w-full rounded-lg bg-brand-dark/40 px-3 py-2 text-sm text-brand-surface focus:outline-none focus:ring-1 focus:ring-brand-teal"
            />
          </div>
        </div>
        <button
          onClick={() => void createTable()}
          disabled={saving || !form.name.trim()}
          className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-teal/90 disabled:opacity-40"
        >
          {saving ? 'Guardando...' : '+ Agregar mesa'}
        </button>
      </div>

      {loading ? (
        <p className="animate-pulse text-sm text-brand-surface/40">Cargando...</p>
      ) : tables.length === 0 ? (
        <p className="text-sm text-brand-surface/40">Sin mesas todavía. Agrega la primera arriba.</p>
      ) : (
        zones.map((zone) => (
          <div key={zone} className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-surface/40">{zone}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {tables.filter((t) => t.zone === zone).map((table) => (
                <div key={table.id} className="flex items-center justify-between rounded-xl bg-brand-navy p-4">
                  <div>
                    <p className="font-semibold text-brand-surface">{table.name}</p>
                    <p className="text-xs text-brand-surface/40">{table.seats} asientos</p>
                  </div>
                  <button
                    onClick={() => void deleteTable(table.id)}
                    className="text-lg text-brand-surface/20 transition hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
