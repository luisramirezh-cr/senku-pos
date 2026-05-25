'use client'

import { useState } from 'react'
import type { Product } from '@/db/schema'
import { formatCRC } from '@/lib/format'

interface Props {
  products: Product[]
  onAdd: (product: Product) => void
}

export function ProductGrid({ products, onAdd }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[]

  const visible =
    activeCategory === null
      ? products
      : products.filter((p) => p.category === activeCategory)

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition ${
            activeCategory === null
              ? 'bg-brand-teal text-brand-dark'
              : 'bg-brand-navy text-brand-surface/60 hover:text-brand-surface'
          }`}
        >
          Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition ${
              activeCategory === cat
                ? 'bg-brand-teal text-brand-dark'
                : 'bg-brand-navy text-brand-surface/60 hover:text-brand-surface'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product cards */}
      {visible.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-brand-surface/40">
          {products.length === 0
            ? 'No hay productos. Agrégalos en /pos/products.'
            : 'Sin productos en esta categoría.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-2 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((product) => (
            <button
              key={product.id}
              onClick={() => onAdd(product)}
              className="group flex flex-col gap-1 rounded-xl bg-brand-navy p-4 text-left transition hover:bg-brand-navy/80 hover:ring-1 hover:ring-brand-teal active:scale-95"
            >
              <span className="line-clamp-2 text-sm font-medium text-brand-surface leading-snug">
                {product.name}
              </span>
              {product.category && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-brand-blue">
                  {product.category}
                </span>
              )}
              <span className="mt-auto pt-2 font-mono text-base font-semibold text-brand-amber">
                {formatCRC(product.price)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
