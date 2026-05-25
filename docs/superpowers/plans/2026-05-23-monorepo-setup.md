# Senku POS — Monorepo Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el monorepo base de Senku POS con pnpm workspaces, TypeScript estricto, ESLint, Prettier, schema Prisma completo y seed de datos — sin funcionalidad, solo la base lista para construir encima.

**Architecture:** Tres apps (`api`, `pos`, `dashboard`) bajo `apps/` comparten paquetes de `packages/` (`db`, `types`, `ui`) via pnpm workspaces. Cada app extiende una tsconfig base compartida. Prisma vive en `packages/db` y solo lo consume el API.

**Tech Stack:** pnpm 9, TypeScript 5.7, ESLint 9 (flat config), Prettier 3, Prisma 5, Fastify 4, React 18, Next.js 14, Vite 5, vite-plugin-pwa

**Design decisions baked into this schema:**
- `Location.hasTableManagement` — controls whether the POS shows floor view (restaurant) or goes directly to counter ordering (food court)
- `Order.orderNumber` — sequential number per location, used as identifier for food court orders (nullable, null for table orders)
- `Modifier.required` — some modifiers are mandatory choices (e.g., "¿término de cocción?"). Admin configures per item in Dashboard.
- `OrderItemModifier` — snapshot of applied modifiers at order time (name + priceDelta copied so historical orders aren't affected by modifier changes)
- `Invoice.paymentMethod` + `Invoice.discount` — tracks how the order was paid and any loyalty discount applied
- `LoyaltyTransaction.pointsRedeemed` + `discountAmount` — loyalty redemption tracking for the Cajero panel
- Post-payment modification: V2 only. V1 = manager PIN + void + recreate.

**Comandeo — Visual Floor Plan (Fase 1):**
- Vista de Piso is a visual floor plan canvas, NOT a card grid
- Tables rendered as circular icons with chair dots positioned by trigonometry (seat count drives layout: 2/4/6 chair presets)
- Status colors are solid fills: libre=`#22C55E`, ocupada=`#F59E0B`, urgente=`#EF4444`; chair dots use pastel variants
- Canvas background: `#F8F9FB` white with subtle grid lines
- Named zones overlay the canvas (e.g. "Zona A — Salón Principal") — V1 zones are hardcoded per location; a `Zone` model with table assignments is V2
- `Table.capacity` drives chair count rendered on the icon — seed must set realistic capacities (2, 4, or 6)

---

## File Map

```
senku-pos/
├── package.json                          CREATE — workspace root, scripts globales
├── pnpm-workspace.yaml                   CREATE — globs de workspaces
├── tsconfig.base.json                    CREATE — config TS compartida (strict: true)
├── eslint.config.mjs                     CREATE — ESLint 9 flat config con TypeScript
├── .prettierrc                           CREATE — reglas de formato
├── .prettierignore                       CREATE — archivos que no formatear
├── .gitignore                            CREATE — ignores estándar Node.js
├── .node-version                         CREATE — pin de Node.js 20
├── README.md                             CREATE — instrucciones de setup local
├── packages/
│   ├── types/
│   │   ├── package.json                  CREATE — @senku/types
│   │   ├── tsconfig.json                 CREATE
│   │   └── src/index.ts                  CREATE — tipos compartidos + ERROR_CODES
│   ├── db/
│   │   ├── package.json                  CREATE — @senku/db
│   │   ├── tsconfig.json                 CREATE
│   │   ├── prisma/
│   │   │   ├── schema.prisma             CREATE — schema completo (todas las tablas)
│   │   │   └── seed.ts                   CREATE — 1 restaurante, 10 items, 6 mesas (2 zonas)
│   │   └── src/index.ts                  CREATE — singleton PrismaClient
│   └── ui/
│       ├── package.json                  CREATE — @senku/ui (placeholder)
│       ├── tsconfig.json                 CREATE
│       └── src/index.ts                  CREATE — export vacío
├── apps/
│   ├── api/
│   │   ├── package.json                  CREATE — @senku/api (Fastify)
│   │   ├── tsconfig.json                 CREATE
│   │   ├── .env.example                  CREATE — vars de entorno documentadas
│   │   └── src/index.ts                  CREATE — servidor Fastify con /health
│   ├── pos/
│   │   ├── package.json                  CREATE — @senku/pos (React + Vite PWA)
│   │   ├── tsconfig.json                 CREATE
│   │   ├── vite.config.ts                CREATE — Vite + React + PWA manifest
│   │   ├── index.html                    CREATE — HTML base con DM Sans
│   │   └── src/
│   │       ├── main.tsx                  CREATE — entry point React
│   │       └── App.tsx                   CREATE — componente raíz placeholder
│   └── dashboard/
│       ├── package.json                  CREATE — @senku/dashboard (Next.js 14)
│       ├── tsconfig.json                 CREATE
│       ├── next.config.js                CREATE
│       └── src/app/
│           ├── layout.tsx                CREATE — RootLayout con DM Sans
│           └── page.tsx                  CREATE — home page placeholder
├── infra/
│   └── README.md                         CREATE — placeholder GCP
└── docs/
    └── architecture/
        └── decisions.md                  CREATE — ADRs iniciales
```

---

### Task 1: Root workspace scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.node-version`

- [ ] **Step 1: Crear package.json raíz**

```json
{
  "name": "senku-pos",
  "private": true,
  "version": "0.0.1",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "scripts": {
    "dev:api": "pnpm --filter @senku/api dev",
    "dev:pos": "pnpm --filter @senku/pos dev",
    "dev:dashboard": "pnpm --filter @senku/dashboard dev",
    "build": "pnpm -r build",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:generate": "pnpm --filter @senku/db generate",
    "db:migrate": "pnpm --filter @senku/db migrate",
    "db:seed": "pnpm --filter @senku/db seed",
    "db:studio": "pnpm --filter @senku/db studio"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "eslint": "^9.17.0",
    "eslint-config-prettier": "^10.0.0",
    "prettier": "^3.4.2",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.19.0"
  }
}
```

- [ ] **Step 2: Crear pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Crear .gitignore**

```
# Dependencies
node_modules/

# Build outputs
dist/
build/
.next/

# Environment
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
*.swp

# Logs
*.log
pnpm-debug.log*
```

- [ ] **Step 4: Crear .node-version**

```
20
```

---

### Task 2: TypeScript base config

**Files:**
- Create: `tsconfig.base.json`

- [ ] **Step 1: Crear tsconfig.base.json**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

---

### Task 3: ESLint + Prettier

**Files:**
- Create: `eslint.config.mjs`
- Create: `.prettierrc`
- Create: `.prettierignore`

- [ ] **Step 1: Crear eslint.config.mjs**

```javascript
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: ['**/dist/**', '**/.next/**', '**/node_modules/**'],
  }
)
```

- [ ] **Step 2: Crear .prettierrc**

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

- [ ] **Step 3: Crear .prettierignore**

```
node_modules/
dist/
.next/
pnpm-lock.yaml
```

---

### Task 4: packages/types

**Files:**
- Create: `packages/types/package.json`
- Create: `packages/types/tsconfig.json`
- Create: `packages/types/src/index.ts`

- [ ] **Step 1: Crear packages/types/package.json**

```json
{
  "name": "@senku/types",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Crear packages/types/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "moduleResolution": "node"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Crear packages/types/src/index.ts**

```typescript
// Roles from Clerk publicMetadata — set by gosenku.com webhooks, never in this repo
export type ClerkRole = 'superadmin' | 'business' | 'cashier' | 'customer'

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING'
export type OrderStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'DELIVERED' | 'PAID' | 'CANCELLED'
export type OrderItemStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'CANCELLED'
export type Channel = 'TABLE' | 'TAKEOUT' | 'DELIVERY'
export type InvoiceStatus = 'PENDING' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONTINGENCY'
export type PaymentMethod = 'CASH' | 'CARD' | 'SINPE' | 'TRANSFER' | 'COURTESY'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  HACIENDA_ERROR: 'HACIENDA_ERROR',
  LOYALTY_SYNC_ERROR: 'LOYALTY_SYNC_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
```

---

### Task 5: packages/db — scaffold y Prisma schema

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/index.ts`

- [ ] **Step 1: Crear packages/db/package.json**

```json
{
  "name": "@senku/db",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "seed": "tsx prisma/seed.ts",
    "studio": "prisma studio",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "prisma": "^5.22.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 2: Crear packages/db/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "moduleResolution": "node"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Crear packages/db/prisma/schema.prisma**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ============================================================
// SHARED TABLES — managed by gosenku.com on the same PostgreSQL
// instance. businessId is a plain String on all POS models —
// no @relation to avoid cross-schema migration conflicts.
// Validated at API layer via business_app_subscriptions.
// ============================================================

model Location {
  id                 String  @id @default(cuid())
  businessId         String
  name               String
  address            String
  timezone           String  @default("America/Costa_Rica")
  hasTableManagement Boolean @default(true)

  tables Table[]
  orders Order[]
}

model Category {
  id         String @id @default(cuid())
  businessId String
  name       String
  sortOrder  Int    @default(0)

  menuItems MenuItem[]
}

model MenuItem {
  id              String  @id @default(cuid())
  businessId      String
  categoryId      String
  name            String
  price           Decimal @db.Decimal(10, 2)
  cost            Decimal @db.Decimal(10, 2)
  prepTimeMinutes Int     @default(10)
  active          Boolean @default(true)

  category   Category    @relation(fields: [categoryId], references: [id])
  modifiers  Modifier[]
  orderItems OrderItem[]
}

model Modifier {
  id         String  @id @default(cuid())
  menuItemId String
  name       String
  priceDelta Decimal @db.Decimal(10, 2)
  required   Boolean @default(false)

  menuItem           MenuItem            @relation(fields: [menuItemId], references: [id])
  orderItemModifiers OrderItemModifier[]
}

model Table {
  id         String      @id @default(cuid())
  locationId String
  name       String
  capacity   Int
  status     TableStatus @default(AVAILABLE)

  location Location @relation(fields: [locationId], references: [id])
  orders   Order[]
}

enum TableStatus {
  AVAILABLE
  OCCUPIED
  RESERVED
  CLEANING
}

model Order {
  id          String      @id @default(cuid())
  businessId  String
  locationId  String
  tableId     String?
  orderNumber Int?        // sequential per location, food court only (null for table orders)
  clerkUserId String      // Clerk user ID — references shared users table
  status      OrderStatus @default(PENDING)
  channel     Channel     @default(TABLE)
  createdAt   DateTime    @default(now())

  location           Location            @relation(fields: [locationId], references: [id])
  table              Table?              @relation(fields: [tableId], references: [id])
  items              OrderItem[]
  invoice            Invoice?
  loyaltyTransaction LoyaltyTransaction?
}

enum OrderStatus {
  PENDING
  IN_PROGRESS
  READY
  DELIVERED
  PAID
  CANCELLED
}

enum Channel {
  TABLE
  TAKEOUT
  DELIVERY
}

model OrderItem {
  id         String          @id @default(cuid())
  orderId    String
  menuItemId String
  qty        Int
  unitPrice  Decimal         @db.Decimal(10, 2)
  notes      String?
  status     OrderItemStatus @default(PENDING)

  order     Order               @relation(fields: [orderId], references: [id])
  menuItem  MenuItem            @relation(fields: [menuItemId], references: [id])
  modifiers OrderItemModifier[]
}

enum OrderItemStatus {
  PENDING
  IN_PROGRESS
  READY
  CANCELLED
}

// Snapshot of modifiers applied at order time — name/price copied so history is immutable
model OrderItemModifier {
  id          String  @id @default(cuid())
  orderItemId String
  modifierId  String
  name        String  // snapshot: won't change if admin renames the modifier
  priceDelta  Decimal @db.Decimal(10, 2) // snapshot: won't change if admin changes the price

  orderItem OrderItem @relation(fields: [orderItemId], references: [id])
  modifier  Modifier  @relation(fields: [modifierId], references: [id])
}

model Invoice {
  id            String         @id @default(cuid())
  orderId       String         @unique
  businessId    String
  haciendaKey   String?
  xmlSent       Boolean        @default(false)
  pdfUrl        String?
  total         Decimal        @db.Decimal(10, 2)
  tax           Decimal        @db.Decimal(10, 2)
  discount      Decimal        @db.Decimal(10, 2) @default(0) // loyalty redemption discount
  paymentMethod PaymentMethod?
  status        InvoiceStatus  @default(PENDING)

  order Order @relation(fields: [orderId], references: [id])
}

enum InvoiceStatus {
  PENDING
  SENT
  ACCEPTED
  REJECTED
  CONTINGENCY
}

enum PaymentMethod {
  CASH
  CARD
  SINPE
  TRANSFER
  COURTESY
}

model LoyaltyTransaction {
  id             String    @id @default(cuid())
  orderId        String    @unique
  businessId     String
  clerkUserId    String?   // Clerk user ID of the customer (from shared users table)
  pointsEarned   Int
  pointsRedeemed Int       @default(0)
  discountAmount Decimal   @db.Decimal(10, 2) @default(0) // ₡ descontados de la factura
  syncedAt       DateTime?

  order Order @relation(fields: [orderId], references: [id])
}
```

- [ ] **Step 4: Crear packages/db/src/index.ts**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'
```

---

### Task 6: packages/db — seed script

**Files:**
- Create: `packages/db/prisma/seed.ts`

- [ ] **Step 1: Crear packages/db/prisma/seed.ts**

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Must be a real business ID from the shared `businesses` table (managed by gosenku.com).
// Set SEED_BUSINESS_ID in apps/api/.env before running the seed.
const BUSINESS_ID = process.env.SEED_BUSINESS_ID ?? 'seed-business-001'

async function main() {
  const location = await prisma.location.upsert({
    where: { id: 'seed-location-001' },
    update: {},
    create: {
      id: 'seed-location-001',
      businessId: BUSINESS_ID,
      name: 'Local Principal',
      address: 'Barrio Escalante, San José, Costa Rica',
      timezone: 'America/Costa_Rica',
      hasTableManagement: true,
    },
  })

  const desayunos = await prisma.category.upsert({
    where: { id: 'seed-cat-desayunos' },
    update: {},
    create: { id: 'seed-cat-desayunos', businessId: BUSINESS_ID, name: 'Desayunos', sortOrder: 1 },
  })

  const almuerzos = await prisma.category.upsert({
    where: { id: 'seed-cat-almuerzos' },
    update: {},
    create: { id: 'seed-cat-almuerzos', businessId: BUSINESS_ID, name: 'Almuerzos', sortOrder: 2 },
  })

  const bebidas = await prisma.category.upsert({
    where: { id: 'seed-cat-bebidas' },
    update: {},
    create: { id: 'seed-cat-bebidas', businessId: BUSINESS_ID, name: 'Bebidas', sortOrder: 3 },
  })

  // 10 items: 4 desayunos, 4 almuerzos, 2 bebidas — precios en colones costarricenses
  const items = [
    { id: 'seed-item-001', categoryId: desayunos.id, name: 'Gallo Pinto con Huevos', price: 3500, cost: 1200, prepTimeMinutes: 10 },
    { id: 'seed-item-002', categoryId: desayunos.id, name: 'Casado de Pollo', price: 4500, cost: 1500, prepTimeMinutes: 15 },
    { id: 'seed-item-003', categoryId: desayunos.id, name: 'Pancakes con Miel', price: 3000, cost: 800, prepTimeMinutes: 8 },
    { id: 'seed-item-004', categoryId: desayunos.id, name: 'Omelet de Vegetales', price: 3200, cost: 1000, prepTimeMinutes: 10 },
    { id: 'seed-item-005', categoryId: almuerzos.id, name: 'Casado de Res', price: 5500, cost: 2000, prepTimeMinutes: 20 },
    { id: 'seed-item-006', categoryId: almuerzos.id, name: 'Casado de Pescado', price: 6000, cost: 2500, prepTimeMinutes: 20 },
    { id: 'seed-item-007', categoryId: almuerzos.id, name: 'Sopa Azteca', price: 4000, cost: 1200, prepTimeMinutes: 5 },
    { id: 'seed-item-008', categoryId: almuerzos.id, name: 'Arroz con Pollo', price: 4800, cost: 1600, prepTimeMinutes: 15 },
    { id: 'seed-item-009', categoryId: bebidas.id, name: 'Refresco Natural', price: 1500, cost: 400, prepTimeMinutes: 3 },
    { id: 'seed-item-010', categoryId: bebidas.id, name: 'Café Costarricense', price: 1200, cost: 300, prepTimeMinutes: 3 },
  ]

  for (const item of items) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: { ...item, businessId: BUSINESS_ID, active: true },
    })
  }

  // Modifiers de ejemplo — Gallo Pinto tiene opciones de huevo, Casado de Res tiene término
  const modifierSeed = [
    { id: 'seed-mod-001', menuItemId: 'seed-item-001', name: 'Huevo frito',    priceDelta: 0,   required: false },
    { id: 'seed-mod-002', menuItemId: 'seed-item-001', name: 'Huevo revuelto', priceDelta: 0,   required: false },
    { id: 'seed-mod-003', menuItemId: 'seed-item-001', name: 'Sin frijoles',   priceDelta: 0,   required: false },
    { id: 'seed-mod-004', menuItemId: 'seed-item-005', name: 'Término 3/4',    priceDelta: 0,   required: true  },
    { id: 'seed-mod-005', menuItemId: 'seed-item-005', name: 'Término medio',  priceDelta: 0,   required: true  },
    { id: 'seed-mod-006', menuItemId: 'seed-item-005', name: 'Bien cocido',    priceDelta: 0,   required: true  },
    { id: 'seed-mod-007', menuItemId: 'seed-item-005', name: 'Extra salsa',    priceDelta: 500, required: false },
  ]

  for (const mod of modifierSeed) {
    await prisma.modifier.upsert({
      where: { id: mod.id },
      update: {},
      create: mod,
    })
  }

  for (const table of [
    // Zona A — Salón Principal
    { id: 'seed-table-001', name: 'Mesa 1', capacity: 4 },
    { id: 'seed-table-002', name: 'Mesa 2', capacity: 6 },
    { id: 'seed-table-003', name: 'Mesa 3', capacity: 2 },
    // Zona B — Terraza
    { id: 'seed-table-004', name: 'Mesa 4', capacity: 4 },
    { id: 'seed-table-005', name: 'Mesa 5', capacity: 6 },
    { id: 'seed-table-006', name: 'Mesa 6', capacity: 2 },
  ]) {
    await prisma.table.upsert({
      where: { id: table.id },
      update: {},
      create: { ...table, locationId: location.id, status: 'AVAILABLE' },
    })
  }

  console.log(`Seed completado: negocio ${BUSINESS_ID} listo para pruebas`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

---

### Task 7: packages/ui — scaffold

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`

- [ ] **Step 1: Crear packages/ui/package.json**

```json
{
  "name": "@senku/ui",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  },
  "peerDependencies": {
    "react": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "react": "^18.3.1",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Crear packages/ui/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "moduleResolution": "node",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Crear packages/ui/src/index.ts**

```typescript
// Componentes UI compartidos — se agregan aquí a medida que se construyen
export {}
```

---

### Task 8: apps/api — scaffold

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/.env.example`
- Create: `apps/api/src/index.ts`

- [ ] **Step 1: Crear apps/api/package.json**

```json
{
  "name": "@senku/api",
  "version": "0.0.1",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@senku/db": "workspace:*",
    "@senku/types": "workspace:*",
    "fastify": "^4.28.1",
    "@fastify/cors": "^9.0.1",
    "@fastify/jwt": "^8.0.1",
    "dotenv": "^16.4.7"
  },
  "devDependencies": {
    "@types/node": "^20.17.9",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Crear apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Crear apps/api/.env.example**

```env
# Base de datos (Cloud SQL en producción, PostgreSQL local en dev)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/senku_pos_dev

# Redis (Cloud Memorystore en producción)
REDIS_URL=redis://localhost:6379

# JWT — mínimo 32 caracteres, distinto por entorno
JWT_SECRET=dev-secret-change-in-production-minimum-32-chars
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production

# Integración Senku Lealtad
SENKU_LEALTAD_API_URL=http://localhost:3003
SENKU_LEALTAD_API_KEY=sk_dev_placeholder

# GCP (no requerido en desarrollo local)
GCP_PROJECT_ID=
GCP_STORAGE_BUCKET=

NODE_ENV=development
PORT=3001
```

- [ ] **Step 4: Crear apps/api/src/index.ts**

```typescript
import 'dotenv/config'
import Fastify from 'fastify'

const server = Fastify({ logger: true })

server.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}))

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3001)
    await server.listen({ port, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
```

---

### Task 9: apps/pos — scaffold React + Vite PWA

**Files:**
- Create: `apps/pos/package.json`
- Create: `apps/pos/tsconfig.json`
- Create: `apps/pos/vite.config.ts`
- Create: `apps/pos/index.html`
- Create: `apps/pos/src/main.tsx`
- Create: `apps/pos/src/App.tsx`

- [ ] **Step 1: Crear apps/pos/package.json**

```json
{
  "name": "@senku/pos",
  "version": "0.0.1",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@senku/types": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.7.2",
    "vite": "^5.4.11",
    "vite-plugin-pwa": "^0.21.1"
  }
}
```

- [ ] **Step 2: Crear apps/pos/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["src/**/*", "vite.config.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Crear apps/pos/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Senku POS',
        short_name: 'SenkuPOS',
        description: 'Sistema de punto de venta para restaurantes',
        theme_color: '#0D9488',
        background_color: '#0F1F35',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: { port: 3002 },
})
```

- [ ] **Step 4: Crear apps/pos/index.html**

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0D9488" />
    <title>Senku POS</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=DM+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Crear apps/pos/src/main.tsx**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 6: Crear apps/pos/src/App.tsx**

```tsx
export function App() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", padding: '2rem', color: '#0F1F35' }}>
      <h1 style={{ color: '#0D9488', margin: '0 0 0.5rem' }}>Senku POS</h1>
      <p style={{ margin: 0 }}>Terminal de punto de venta — en construcción</p>
    </div>
  )
}
```

---

### Task 10: apps/dashboard — scaffold Next.js 14

**Files:**
- Create: `apps/dashboard/package.json`
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/next.config.js`
- Create: `apps/dashboard/src/app/layout.tsx`
- Create: `apps/dashboard/src/app/page.tsx`

- [ ] **Step 1: Crear apps/dashboard/package.json**

```json
{
  "name": "@senku/dashboard",
  "version": "0.0.1",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@senku/types": "workspace:*",
    "next": "14.2.22",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.17.9",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Crear apps/dashboard/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    },
    "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Crear apps/dashboard/next.config.js**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@senku/types', '@senku/ui'],
}

module.exports = nextConfig
```

- [ ] **Step 4: Crear apps/dashboard/src/app/layout.tsx**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Senku POS — Dashboard',
  description: 'Panel de administración para restaurantes',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Crear apps/dashboard/src/app/page.tsx**

```tsx
export default function Home() {
  return (
    <main style={{ padding: '2rem', color: '#0F1F35' }}>
      <h1 style={{ color: '#0D9488', margin: '0 0 0.5rem' }}>Senku POS — Dashboard</h1>
      <p style={{ margin: 0 }}>Panel de administración para restaurantes — en construcción</p>
    </main>
  )
}
```

---

### Task 11: infra + docs placeholders

**Files:**
- Create: `infra/README.md`
- Create: `docs/architecture/decisions.md`

- [ ] **Step 1: Crear infra/README.md**

```markdown
# Infraestructura — Google Cloud Platform

## Servicios objetivo

| Servicio | Propósito |
|----------|-----------|
| Cloud Run `senku-pos-api` | API Fastify |
| Cloud Run `senku-pos-dashboard` | Dashboard Next.js → pos.gosenku.com |
| Cloud Run `senku-pos-terminal` | Terminal POS PWA → terminal.gosenku.com |
| Cloud SQL PostgreSQL 15 | Base de datos principal |
| Cloud Memorystore Redis | Cache y colas BullMQ |
| Cloud Storage `senku-pos-documents` | XMLs de facturas y PDFs |
| Secret Manager | Certificados Hacienda por tenant |

## Configuración pendiente

Ver `SENKU_POS_MASTER_PROMPT.md` → sección "Arquitectura Técnica" para la arquitectura objetivo.
Terraform configs se agregan aquí cuando el proyecto llegue a producción.
```

- [ ] **Step 2: Crear docs/architecture/decisions.md**

```markdown
# Decisiones de Arquitectura (ADRs)

## ADR-001: pnpm workspaces para monorepo

**Decisión:** Usar pnpm workspaces con estructura `apps/` + `packages/`.
**Razón:** Las 3 apps comparten tipos y componentes sin duplicar código. pnpm es más eficiente en disco que npm workspaces y soporta mejor el hoisting selectivo.

## ADR-002: Prisma en packages/db compartido

**Decisión:** Un solo `schema.prisma`, consumido únicamente por la API.
**Razón:** Solo el API accede a la base de datos. Centralizar el schema evita inconsistencias. El dashboard y el POS consumen datos vía API REST.

## ADR-003: Terminal POS como PWA con Vite

**Decisión:** React + Vite + vite-plugin-pwa, sin Next.js.
**Razón:** Los restaurantes necesitan operar offline. La PWA permite instalar el terminal como app en tablets y usar Service Workers para modo offline con IndexedDB.

## ADR-004: Factura electrónica async con BullMQ

**Decisión:** El envío a Hacienda no bloquea la venta; se procesa en cola BullMQ.
**Razón:** Hacienda puede tardar o fallar. La venta cierra inmediatamente; la factura se envía en background con reintentos automáticos. Si falla, modo contingencia.

## ADR-005: Certificados Hacienda en GCP Secret Manager por tenant

**Decisión:** Cada restaurante sube su `.p12` al onboardearse; se almacena en Secret Manager bajo `senku-pos/{tenantId}/hacienda-cert`.
**Razón:** Los certificados son datos sensibles per-tenant. Secret Manager ofrece auditoría, rotación y acceso granular. Nunca en base de datos ni en variables de entorno.
```

---

### Task 12: Instalar dependencias y verificar

**Files:** ninguno (solo comandos)

> **Nota:** Este paso requiere pnpm instalado globalmente (`npm install -g pnpm`). El seed (`pnpm db:seed`) requiere PostgreSQL corriendo y `apps/api/.env` configurado. Los pasos de typecheck y lint NO requieren base de datos.

- [ ] **Step 1: Instalar todas las dependencias del workspace**

```bash
cd c:\Users\lramirez\Documents\senku-pos
pnpm install
```

Resultado esperado: `node_modules` en root y en cada app/package, sin errores.

- [ ] **Step 2: Generar el cliente Prisma**

```bash
pnpm db:generate
```

Resultado esperado: `✔ Generated Prisma Client` en `packages/db/node_modules/.prisma/client`.

- [ ] **Step 3: Verificar TypeScript en todo el monorepo**

```bash
pnpm typecheck
```

Resultado esperado: ningún error de tipos en ningún paquete o app.

- [ ] **Step 4: Verificar ESLint**

```bash
pnpm lint
```

Resultado esperado: 0 warnings, 0 errors.

- [ ] **Step 5 (opcional — requiere PostgreSQL local): Crear base de datos y correr seed**

```bash
# Crear la DB primero (en psql o pgAdmin):
# CREATE DATABASE senku_pos_dev;

# Copiar .env.example
cp apps/api/.env.example apps/api/.env

# Correr migraciones y seed
pnpm db:migrate
pnpm db:seed
```

Resultado esperado: `Seed completado: Soda El Senku lista para pruebas`

---

### Task 13: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Crear README.md en la raíz**

```markdown
# Senku POS

Sistema de punto de venta cloud para restaurantes en Costa Rica. Parte del ecosistema [Senku](https://gosenku.com).

## Requisitos

- [Node.js 20+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/installation) — `npm install -g pnpm`
- [PostgreSQL 15+](https://www.postgresql.org/)

## Setup inicial

### 1. Instalar dependencias

```bash
pnpm install
```

### 2. Configurar variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
```

Editar `apps/api/.env` con tu configuración local (mínimo: `DATABASE_URL`).

### 3. Preparar la base de datos

```bash
# Crear la base de datos en PostgreSQL
createdb senku_pos_dev

# Generar cliente Prisma
pnpm db:generate

# Ejecutar migraciones
pnpm db:migrate

# Cargar datos de prueba
pnpm db:seed
```

### 4. Levantar los servicios

En terminales separados:

```bash
pnpm dev:api        # API → http://localhost:3001
pnpm dev:pos        # Terminal POS → http://localhost:3002
pnpm dev:dashboard  # Dashboard → http://localhost:3000
```

Verificar que el API responde:
```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"..."}
```

## Estructura del proyecto

```
senku-pos/
├── apps/
│   ├── api/          # Fastify API (Node.js) — puerto 3001
│   ├── pos/          # Terminal POS (React PWA) — puerto 3002
│   └── dashboard/    # Panel admin (Next.js) — puerto 3000
├── packages/
│   ├── db/           # Prisma schema + cliente compartido
│   ├── types/        # TypeScript types compartidos
│   └── ui/           # Componentes UI compartidos
├── infra/            # Configuración GCP / Terraform
└── docs/             # PRDs, ADRs, decisiones de arquitectura
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `pnpm dev:api` | API en modo desarrollo con hot-reload |
| `pnpm dev:pos` | Terminal POS en modo desarrollo |
| `pnpm dev:dashboard` | Dashboard en modo desarrollo |
| `pnpm build` | Compila todos los paquetes |
| `pnpm typecheck` | Verifica tipos en todo el monorepo |
| `pnpm lint` | Corre ESLint |
| `pnpm format` | Formatea con Prettier |
| `pnpm db:generate` | Genera el cliente Prisma |
| `pnpm db:migrate` | Ejecuta migraciones pendientes |
| `pnpm db:seed` | Carga datos de prueba |
| `pnpm db:studio` | Abre Prisma Studio (UI para la DB) |

## Datos de prueba (seed)

El seed crea:
- **Restaurante:** Soda El Senku (`ruc: 3-101-123456`)
- **Usuario admin:** `admin@sodaelsenku.com` / contraseña: `senku1234`
- **Categorías:** Desayunos, Almuerzos, Bebidas
- **10 ítems de menú** con precios en colones costarricenses
- **6 mesas en 2 zonas:** Zona A — Salón Principal (Mesa 1: 4, Mesa 2: 6, Mesa 3: 2) · Zona B — Terraza (Mesa 4: 4, Mesa 5: 6, Mesa 6: 2). Las capacidades 2/4/6 cubren los 3 layouts de sillas del floor plan visual.

## Stack técnico

| Capa | Tecnología |
|------|------------|
| API | Node.js + Fastify 4 |
| Dashboard | Next.js 14 (App Router) |
| Terminal POS | React 18 + Vite 5 (PWA) |
| Base de datos | PostgreSQL 15 + Prisma 5 |
| Cache / colas | Redis + BullMQ |
| ORM | Prisma |
| Infraestructura | Google Cloud Platform |
| Monorepo | pnpm workspaces |

## Documentación

- `SENKU_POS_MASTER_PROMPT.md` — contexto completo del proyecto y decisiones
- `docs/architecture/decisions.md` — ADRs
- `infra/README.md` — configuración de infraestructura
```

---

## Self-Review

**Spec coverage check:**

| Requisito del master prompt | Tarea que lo implementa |
|-----------------------------|------------------------|
| pnpm workspaces | Task 1 |
| 3 apps: api, pos, dashboard | Tasks 8, 9, 10 |
| packages: db, types, ui | Tasks 4, 5, 7 |
| TypeScript estricto | Task 2 (`strict: true`) |
| ESLint + Prettier | Task 3 |
| Estructura exacta del master prompt | File Map |
| Schema Prisma con todas las tablas | Task 5 (schema.prisma) |
| Seed: 1 restaurante, 10 items, 6 mesas (2 zonas) | Task 6 |
| README con instrucciones de setup | Task 13 |
| Sin funcionalidad — solo base | Confirmado: solo scaffolds |

**Placeholder scan:** Ningún TBD, ningún "implement later". Todos los archivos tienen contenido completo.

**Type consistency:** Los enums en `packages/types/src/index.ts` (Role, TableStatus, etc.) son string literals que coinciden con los enums de Prisma. El seed usa los valores de string directamente que Prisma acepta.
