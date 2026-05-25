'use client'

import { useReducer, useCallback } from 'react'
import type { Product } from '@/db/schema'

export interface CartItem {
  product: Product
  quantity: number
}

type CartAction =
  | { type: 'ADD'; product: Product }
  | { type: 'REMOVE'; productId: string }
  | { type: 'SET_QTY'; productId: string; qty: number }
  | { type: 'CLEAR' }

function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'ADD': {
      const existing = state.find((i) => i.product.id === action.product.id)
      if (existing) {
        return state.map((i) =>
          i.product.id === action.product.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [...state, { product: action.product, quantity: 1 }]
    }
    case 'REMOVE':
      return state.filter((i) => i.product.id !== action.productId)
    case 'SET_QTY':
      if (action.qty <= 0) return state.filter((i) => i.product.id !== action.productId)
      return state.map((i) =>
        i.product.id === action.productId ? { ...i, quantity: action.qty } : i,
      )
    case 'CLEAR':
      return []
    default:
      return state
  }
}

export function useCart() {
  const [items, dispatch] = useReducer(cartReducer, [])

  const addItem = useCallback((product: Product) => dispatch({ type: 'ADD', product }), [])
  const removeItem = useCallback((productId: string) => dispatch({ type: 'REMOVE', productId }), [])
  const setQty = useCallback(
    (productId: string, qty: number) => dispatch({ type: 'SET_QTY', productId, qty }),
    [],
  )
  const clear = useCallback(() => dispatch({ type: 'CLEAR' }), [])

  const total = items.reduce(
    (sum, item) => sum + parseFloat(item.product.price) * item.quantity,
    0,
  )

  return { items, addItem, removeItem, setQty, clear, total }
}
