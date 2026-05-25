'use client'

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { usePosSession } from '@/context/pos-session-context'
import type { CashSession } from '@/db/schema'
import { formatCRC } from '@/lib/format'

export default function SessionsPage() {
  const { activeBusiness } = usePosSession()
  const [sessions, setSessions] = useState<CashSession[]>([])
  const [loading, setLoading] = useState(true)
  const [openingBalance, setOpeningBalance] = useState('')
  const [closingBalance, setClosingBalance] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const openSession = sessions.find((s) => s.status === 'open') ?? null
  const closedSessions = sessions.filter((s) => s.status === 'closed')

  async function loadSessions() {
    if (!activeBusiness?.id) return
    setLoading(true)
    const res = await fetch(`/api/sessions?businessId=${activeBusiness.id}`)
    const data = await res.json()
    setSessions((data as CashSession[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadSessions()
  }, [activeBusiness?.id])

  async function handleOpen(e: FormEvent) {
    e.preventDefault()
    if (!activeBusiness?.id) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId: activeBusiness.id, openingBalance }),
    })
    if (res.ok) {
      setOpeningBalance('')
      loadSessions()
    } else {
      const d = await res.json() as { error?: string }
      setError(d.error ?? 'Error al abrir turno')
    }
    setSaving(false)
  }

  async function handleClose(e: FormEvent) {
    e.preventDefault()
    if (!openSession) return
    setSaving(true)
    await fetch(`/api/sessions/${openSession.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closingBalance }),
    })
    setClosingBalance('')
    setSaving(false)
    loadSessions()
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-sm text-brand-surface/40">
        Cargando...
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] gap-6 p-6">
      {/* Left: active session */}
      <div className="w-80 shrink-0">
        {openSession ? (
          <div className="rounded-2xl bg-brand-navy p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="font-semibold text-brand-surface">Turno activo</h2>
            </div>

            <div className="mb-5 space-y-2 text-sm">
              <Row label="Abierto" value={new Date(openSession.openedAt).toLocaleString('es-CR')} />
              <Row label="Apertura" value={formatCRC(openSession.openingBalance)} mono />
              {openSession.totalSales && (
                <Row label="Ventas" value={formatCRC(openSession.totalSales)} mono />
              )}
            </div>

            <form onSubmit={handleClose} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-brand-surface/50">Efectivo en caja</label>
                <input
                  required
                  type="number"
                  value={closingBalance}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setClosingBalance(e.target.value)}
                  className={inputCls}
                  placeholder="0"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-500/80 py-2.5 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-40"
              >
                {saving ? 'Cerrando...' : 'Cerrar turno'}
              </button>
            </form>
          </div>
        ) : (
          <div className="rounded-2xl bg-brand-navy p-5">
            <h2 className="mb-4 font-semibold text-brand-surface">Abrir turno</h2>
            {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
            <form onSubmit={handleOpen} className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs text-brand-surface/50">Efectivo inicial</label>
                <input
                  required
                  type="number"
                  value={openingBalance}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setOpeningBalance(e.target.value)}
                  className={inputCls}
                  placeholder="0"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-brand-dark transition hover:bg-brand-teal/90 disabled:opacity-40"
              >
                {saving ? 'Abriendo...' : 'Abrir turno'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Right: history */}
      <div className="flex-1 overflow-hidden rounded-2xl bg-brand-navy">
        <div className="border-b border-brand-dark/60 px-5 py-3">
          <h2 className="text-sm font-semibold text-brand-surface/60">Turnos anteriores</h2>
        </div>
        {closedSessions.length === 0 ? (
          <div className="flex h-full items-center justify-center pb-10 text-sm text-brand-surface/30">
            Sin turnos cerrados aún
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-dark/40 text-left">
                  <th className="px-4 py-3 font-medium text-brand-surface/40">Apertura</th>
                  <th className="px-4 py-3 font-medium text-brand-surface/40">Cierre</th>
                  <th className="px-4 py-3 font-medium text-brand-surface/40 text-right">Apertura ₡</th>
                  <th className="px-4 py-3 font-medium text-brand-surface/40 text-right">Cierre ₡</th>
                  <th className="px-4 py-3 font-medium text-brand-surface/40 text-right">Total ventas</th>
                </tr>
              </thead>
              <tbody>
                {closedSessions.map((s) => (
                  <tr key={s.id} className="border-b border-brand-dark/30 hover:bg-brand-dark/20">
                    <td className="px-4 py-3 font-mono text-xs text-brand-surface/70">
                      {new Date(s.openedAt).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-brand-surface/50">
                      {s.closedAt
                        ? new Date(s.closedAt).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-brand-surface/60">
                      {formatCRC(s.openingBalance)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-brand-surface/60">
                      {s.closingBalance ? formatCRC(s.closingBalance) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-brand-amber">
                      {s.totalSales ? formatCRC(s.totalSales) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-brand-surface/50">{label}</span>
      <span className={`text-brand-surface ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg bg-brand-dark/40 px-3 py-2 text-sm text-brand-surface placeholder-brand-surface/20 focus:outline-none focus:ring-1 focus:ring-brand-teal'
