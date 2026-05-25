'use client'

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { usePosSession } from '@/context/pos-session-context'
import type { Product } from '@/db/schema'
import { formatCRC } from '@/lib/format'

interface ProductForm {
  name: string
  category: string
  price: string
  description: string
  sku: string
  stock: string
}

const EMPTY_FORM: ProductForm = {
  name: '',
  category: '',
  price: '',
  description: '',
  sku: '',
  stock: '',
}

export default function ProductsPage() {
  const { activeBusiness } = usePosSession()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function loadProducts() {
    if (!activeBusiness?.id) return
    setLoading(true)
    const res = await fetch(`/api/products?businessId=${activeBusiness.id}`)
    const data = await res.json()
    setProducts((data as Product[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadProducts()
  }, [activeBusiness?.id])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModal('create')
  }

  function openEdit(p: Product) {
    setEditing(p)
    setForm({
      name: p.name,
      category: p.category ?? '',
      price: p.price,
      description: p.description ?? '',
      sku: p.sku ?? '',
      stock: p.stock ?? '',
    })
    setModal('edit')
  }

  function field(key: keyof ProductForm) {
    return {
      value: form[key],
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!activeBusiness?.id) return
    setSaving(true)

    const payload = {
      ...form,
      businessId: activeBusiness.id,
      isActive: true,
      stock: form.stock || null,
      sku: form.sku || null,
      description: form.description || null,
      category: form.category || null,
    }

    if (modal === 'create') {
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else if (editing) {
      await fetch(`/api/products/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }

    setSaving(false)
    setModal(null)
    loadProducts()
  }

  async function toggleActive(p: Product) {
    if (p.isActive) {
      await fetch(`/api/products/${p.id}`, { method: 'DELETE' })
    } else {
      await fetch(`/api/products/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
    }
    loadProducts()
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-4 p-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-brand-surface">Productos</h1>
        <button
          onClick={openCreate}
          className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-brand-teal/90"
        >
          + Nuevo producto
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl bg-brand-navy">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-brand-surface/40">
            Cargando...
          </div>
        ) : products.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <p className="text-sm text-brand-surface/40">Sin productos aún.</p>
            <button
              onClick={openCreate}
              className="text-sm text-brand-teal hover:underline"
            >
              Crear el primero
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-dark/60 text-left">
                <th className="px-4 py-3 font-medium text-brand-surface/40">Nombre</th>
                <th className="px-4 py-3 font-medium text-brand-surface/40">Categoría</th>
                <th className="px-4 py-3 font-medium text-brand-surface/40 text-right">Precio</th>
                <th className="px-4 py-3 font-medium text-brand-surface/40">SKU</th>
                <th className="px-4 py-3 font-medium text-brand-surface/40 text-right">Stock</th>
                <th className="px-4 py-3 font-medium text-brand-surface/40">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-brand-dark/30 transition hover:bg-brand-dark/20"
                >
                  <td className="px-4 py-3 font-medium text-brand-surface">{p.name}</td>
                  <td className="px-4 py-3">
                    {p.category ? (
                      <span className="rounded-full bg-brand-blue/20 px-2 py-0.5 text-xs font-medium text-brand-blue">
                        {p.category}
                      </span>
                    ) : (
                      <span className="text-brand-surface/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-brand-amber">
                    {formatCRC(p.price)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-surface/50">
                    {p.sku ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {p.stock != null ? (
                      <span className={parseInt(p.stock) <= 5 ? 'text-brand-amber' : 'text-brand-surface/60'}>
                        {p.stock}
                      </span>
                    ) : (
                      <span className="text-brand-surface/20">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
                        p.isActive
                          ? 'bg-emerald-500/20 text-emerald-400 hover:bg-red-500/20 hover:text-red-400'
                          : 'bg-brand-dark/40 text-brand-surface/30 hover:bg-emerald-500/20 hover:text-emerald-400'
                      }`}
                    >
                      {p.isActive ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-brand-surface/40 transition hover:text-brand-teal"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/80 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-brand-navy p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-brand-surface">
                {modal === 'create' ? 'Nuevo producto' : 'Editar producto'}
              </h2>
              <button onClick={() => setModal(null)} className="text-brand-surface/40 hover:text-brand-surface">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-brand-surface/50">Nombre *</label>
                  <input required {...field('name')} className={inputCls} placeholder="Café americano" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-brand-surface/50">Precio (₡) *</label>
                  <input required type="number" step="1" {...field('price')} className={inputCls} placeholder="1500" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-brand-surface/50">Categoría</label>
                  <input {...field('category')} className={inputCls} placeholder="Bebidas" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-brand-surface/50">SKU</label>
                  <input {...field('sku')} className={inputCls} placeholder="CAF-001" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-brand-surface/50">Stock</label>
                  <input type="number" {...field('stock')} className={inputCls} placeholder="—" />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-brand-surface/50">Descripción</label>
                  <input {...field('description')} className={inputCls} placeholder="Opcional" />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="mt-2 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-brand-dark transition hover:bg-brand-teal/90 disabled:opacity-40"
              >
                {saving ? 'Guardando...' : modal === 'create' ? 'Crear producto' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-lg bg-brand-dark/40 px-3 py-2 text-sm text-brand-surface placeholder-brand-surface/20 focus:outline-none focus:ring-1 focus:ring-brand-teal'
