# Phase 1 — POS Terminal Screen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Goal:** Build the functional `/pos` terminal — product catalog + cart + cobrar modal — wired to the senku_pos DB.

**Architecture:** Next.js 15 App Router, Drizzle ORM, React state (no Zustand), brand tokens via Tailwind.

**Screen layout:**
```
┌─────────────────────────────────────────────────┐
│ Header: logo | business name | cashier | logout  │
├──────────────────────┬──────────────────────────┤
│ Catálogo (productos) │ Carrito                  │
│ [filter tabs]        │ Item 1 ×2  ₡3,000        │
│ [Card][Card][Card]   │ Item 2 ×1  ₡1,500        │
│ [Card][Card][Card]   │ ──────────────────        │
│                      │ Total: ₡4,500             │
│                      │ [Limpiar] [Cobrar →]      │
└──────────────────────┴──────────────────────────┘
```

---

## File Map

**Create:**
- `apps/pos/src/lib/format.ts` — currency formatter (CRC)
- `apps/pos/src/app/api/products/route.ts`
- `apps/pos/src/app/api/sales/route.ts`
- `apps/pos/src/app/(pos)/pos/_hooks/useCart.ts`
- `apps/pos/src/app/(pos)/pos/_components/Header.tsx`
- `apps/pos/src/app/(pos)/pos/_components/ProductGrid.tsx`
- `apps/pos/src/app/(pos)/pos/_components/CartPanel.tsx`
- `apps/pos/src/app/(pos)/pos/_components/CobrarModal.tsx`
- `apps/pos/src/app/(pos)/pos/page.tsx` (replace placeholder)

**Modify:**
- `apps/pos/src/app/(pos)/layout.tsx` — add PosSessionProvider + Header
