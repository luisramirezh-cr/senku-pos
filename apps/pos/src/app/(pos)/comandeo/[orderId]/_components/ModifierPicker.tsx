'use client'

import { useState } from 'react'
import { formatCRC } from '@/lib/format'

interface ModifierOption {
  id: string
  name: string
  priceDelta: string
}

interface ModifierGroup {
  id: string
  name: string
  required: boolean
  multiSelect: boolean
  options: ModifierOption[]
}

interface SelectedModifier {
  groupName: string
  optionName: string
  priceDelta: string
}

interface Props {
  productName: string
  productPrice: number
  groups: ModifierGroup[]
  onConfirm: (modifiers: SelectedModifier[], notes: string) => void
  onClose: () => void
}

export function ModifierPicker({ productName, productPrice, groups, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState<Record<string, string[]>>({})
  const [notes, setNotes] = useState('')

  function toggle(group: ModifierGroup, optionId: string) {
    setSelected((prev) => {
      const current = prev[group.id] ?? []
      if (group.multiSelect) {
        return {
          ...prev,
          [group.id]: current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId],
        }
      }
      return { ...prev, [group.id]: current[0] === optionId ? [] : [optionId] }
    })
  }

  const missingRequired = groups.filter((g) => g.required && !(selected[g.id]?.length))

  const selectedModifiers: SelectedModifier[] = groups.flatMap((g) =>
    (selected[g.id] ?? []).map((optId) => {
      const opt = g.options.find((o) => o.id === optId)!
      return { groupName: g.name, optionName: opt.name, priceDelta: opt.priceDelta }
    }),
  )

  const totalDelta = selectedModifiers.reduce((sum, m) => sum + parseFloat(m.priceDelta), 0)
  const finalPrice = productPrice + totalDelta

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl bg-brand-navy shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-surface/5 px-5 py-4">
          <div>
            <p className="font-bold text-brand-surface">{productName}</p>
            <p className="font-mono text-xs text-brand-teal">{formatCRC(finalPrice)}</p>
          </div>
          <button onClick={onClose} className="text-xl text-brand-surface/30 hover:text-brand-surface">×</button>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {groups.map((group) => (
            <div key={group.id}>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-surface/50">{group.name}</p>
                {group.required && (
                  <span className="rounded bg-brand-teal/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-teal">
                    Requerido
                  </span>
                )}
                {group.multiSelect && (
                  <span className="rounded bg-brand-surface/10 px-1.5 py-0.5 text-[10px] text-brand-surface/40">
                    Varios
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.options.map((opt) => {
                  const isSelected = (selected[group.id] ?? []).includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggle(group, opt.id)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-brand-teal text-brand-dark'
                          : 'bg-brand-dark/40 text-brand-surface/70 hover:bg-brand-dark/60'
                      }`}
                    >
                      {opt.name}
                      {parseFloat(opt.priceDelta) !== 0 && (
                        <span className="ml-1 opacity-70">
                          {parseFloat(opt.priceDelta) > 0 ? '+' : ''}
                          {formatCRC(parseFloat(opt.priceDelta))}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand-surface/50">Nota (opcional)</p>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sin cebolla, bien cocido..."
              className="w-full rounded-lg bg-brand-dark/40 px-3 py-2 text-sm text-brand-surface placeholder:text-brand-surface/30 outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-brand-surface/5 px-5 py-4">
          {missingRequired.length > 0 && (
            <p className="mb-2 text-center text-xs text-red-400">
              Selecciona: {missingRequired.map((g) => g.name).join(', ')}
            </p>
          )}
          <button
            onClick={() => onConfirm(selectedModifiers, notes)}
            disabled={missingRequired.length > 0}
            className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-brand-dark transition hover:bg-brand-teal/90 disabled:opacity-40"
          >
            Agregar · {formatCRC(finalPrice)}
          </button>
        </div>
      </div>
    </div>
  )
}
