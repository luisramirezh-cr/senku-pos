'use client'

import type { CartItem } from '../_hooks/useCart'
import { formatCRC } from '@/lib/format'

interface Props {
  items: CartItem[]
  total: number
  onSetQty: (productId: string, qty: number) => void
  onRemove: (productId: string) => void
  onClear: () => void
  onCobrar: () => void
}

export function CartPanel({ items, total, onSetQty, onRemove, onClear, onCobrar }: Props) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-xl bg-brand-navy p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-surface/40">
        Carrito
      </h2>

      {/* Item list */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {items.length === 0 ? (
          <p className="pt-8 text-center text-sm text-brand-surface/30">
            Selecciona productos del catálogo
          </p>
        ) : (
          items.map(({ product, quantity }) => (
            <div
              key={product.id}
              className="flex items-center gap-3 rounded-lg bg-brand-dark/40 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-brand-surface">{product.name}</p>
                <p className="font-mono text-xs text-brand-amber">
                  {formatCRC(parseFloat(product.price) * quantity)}
                </p>
              </div>

              {/* Qty controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSetQty(product.id, quantity - 1)}
                  className="flex h-6 w-6 items-center justify-center rounded bg-brand-navy text-brand-surface/60 hover:bg-brand-dark hover:text-brand-surface"
                >
                  −
                </button>
                <span className="w-6 text-center font-mono text-sm text-brand-surface">
                  {quantity}
                </span>
                <button
                  onClick={() => onSetQty(product.id, quantity + 1)}
                  className="flex h-6 w-6 items-center justify-center rounded bg-brand-navy text-brand-surface/60 hover:bg-brand-dark hover:text-brand-surface"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => onRemove(product.id)}
                className="text-brand-surface/30 hover:text-red-400"
                aria-label="Eliminar"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Total + actions */}
      <div className="border-t border-brand-dark/60 pt-4">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-sm text-brand-surface/60">Total</span>
          <span className="font-mono text-2xl font-bold text-brand-surface">
            {formatCRC(total)}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClear}
            disabled={items.length === 0}
            className="flex-1 rounded-lg py-2.5 text-sm font-medium text-brand-surface/50 transition hover:bg-brand-dark/60 hover:text-brand-surface disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Limpiar
          </button>
          <button
            onClick={onCobrar}
            disabled={items.length === 0}
            className="flex-[2] rounded-lg bg-brand-teal py-2.5 text-sm font-bold text-brand-dark transition hover:bg-brand-teal/90 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Cobrar →
          </button>
        </div>
      </div>
    </div>
  )
}
