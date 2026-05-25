'use client'

import { useEffect, useState, type ChangeEvent } from 'react'
import { usePosSession } from '@/context/pos-session-context'
import type { Sale } from '@/db/schema'
import { formatCRC } from '@/lib/format'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  sinpe: 'SINPE',
}

const METHOD_COLORS: Record<string, string> = {
  cash: 'text-emerald-400 bg-emerald-500/10',
  card: 'text-brand-blue bg-brand-blue/10',
  sinpe: 'text-brand-amber bg-brand-amber/10',
}

export default function HistoryPage() {
  const { activeBusiness } = usePosSession()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [method, setMethod] = useState('')

  async function load() {
    if (!activeBusiness?.id) return
    setLoading(true)
    const params = new URLSearchParams({ businessId: activeBusiness.id })
    if (from) params.set('from', from)
    if (to) params.set('to', to + 'T23:59:59')
    if (method) params.set('method', method)
    const res = await fetch(`/api/sales?${params}`)
    const data = await res.json()
    setSales((data as Sale[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [activeBusiness?.id])

  const total = sales.reduce((sum, s) => sum + parseFloat(s.total), 0)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-4 p-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-brand-surface/50">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFrom(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-brand-surface/50">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setTo(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-brand-surface/50">Método</label>
          <select
            value={method}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setMethod(e.target.value)}
            className={inputCls}
          >
            <option value="">Todos</option>
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="sinpe">SINPE</option>
          </select>
        </div>
        <button
          onClick={load}
          className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-teal/90"
        >
          Filtrar
        </button>
      </div>

      {/* Summary */}
      {!loading && sales.length > 0 && (
        <div className="flex gap-6 rounded-xl bg-brand-navy px-5 py-3">
          <div>
            <p className="text-xs text-brand-surface/40">Ventas</p>
            <p className="font-mono text-xl font-bold text-brand-surface">{sales.length}</p>
          </div>
          <div>
            <p className="text-xs text-brand-surface/40">Total</p>
            <p className="font-mono text-xl font-bold text-brand-amber">{formatCRC(total)}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl bg-brand-navy">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-brand-surface/40">
            Cargando...
          </div>
        ) : sales.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-brand-surface/40">
            Sin ventas en este período.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-dark/60 text-left">
                <th className="px-4 py-3 font-medium text-brand-surface/40">Fecha</th>
                <th className="px-4 py-3 font-medium text-brand-surface/40">Hora</th>
                <th className="px-4 py-3 font-medium text-brand-surface/40">Método</th>
                <th className="px-4 py-3 font-medium text-brand-surface/40 text-right">Total</th>
                <th className="px-4 py-3 font-medium text-brand-surface/40">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => {
                const dt = new Date(s.createdAt)
                return (
                  <tr key={s.id} className="border-b border-brand-dark/30 hover:bg-brand-dark/20">
                    <td className="px-4 py-3 font-mono text-xs text-brand-surface/70">
                      {dt.toLocaleDateString('es-CR')}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-brand-surface/50">
                      {dt.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${METHOD_COLORS[s.paymentMethod] ?? 'text-brand-surface/40'}`}
                      >
                        {METHOD_LABELS[s.paymentMethod] ?? s.paymentMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-brand-amber">
                      {formatCRC(s.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-emerald-400">Completada</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const inputCls =
  'rounded-lg bg-brand-navy border border-brand-dark/60 px-3 py-2 text-sm text-brand-surface focus:outline-none focus:ring-1 focus:ring-brand-teal'
