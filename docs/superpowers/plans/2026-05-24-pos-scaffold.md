# Senku POS — Phase 0 Scaffold (Clean)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold the `apps/pos` Next.js 15 app with Drizzle ORM, Tailwind CSS, shadcn/ui, Clerk satellite auth, and the core DB schema for senku_pos.

**Architecture:**
- Single Next.js 15 App Router app at `apps/pos/` (pos.gosenku.com)
- Own database (`senku_pos`) — not shared with gosenku.com or loyalty
- Drizzle ORM + pg driver for DB access
- Auth via Clerk satellite + gosenku.com internal API for access verification

**Tech Stack:** Next.js 15, TypeScript strict, Tailwind CSS, shadcn/ui, Drizzle ORM, pg, Clerk (@clerk/nextjs)

---

## File Map

**Create:**
- `apps/pos/package.json`
- `apps/pos/tsconfig.json`
- `apps/pos/next.config.ts`
- `apps/pos/tailwind.config.ts`
- `apps/pos/postcss.config.mjs`
- `apps/pos/drizzle.config.ts`
- `apps/pos/.env.example`
- `apps/pos/Dockerfile`
- `apps/pos/src/app/layout.tsx` — root layout with ClerkProvider + brand fonts
- `apps/pos/src/app/page.tsx` — redirect to /pos
- `apps/pos/src/app/globals.css` — brand tokens + Tailwind base
- `apps/pos/src/app/(pos)/layout.tsx` — protected layout
- `apps/pos/src/app/(pos)/pos/page.tsx` — terminal placeholder
- `apps/pos/src/app/api/health/route.ts`
- `apps/pos/src/app/api/session/route.ts`
- `apps/pos/src/db/index.ts` — Drizzle client
- `apps/pos/src/db/schema/products.ts`
- `apps/pos/src/db/schema/sales.ts`
- `apps/pos/src/db/schema/sale-items.ts`
- `apps/pos/src/db/schema/cash-sessions.ts`
- `apps/pos/src/db/schema/index.ts`
- `apps/pos/src/lib/root-api.ts` — gosenku.com internal API helper
- `apps/pos/src/context/pos-session-context.tsx`
- `apps/pos/src/middleware.ts`

**Modify:**
- `package.json` (root) — update scripts for new structure
- `pnpm-workspace.yaml` — verify packages list

---

### Task 1: apps/pos package.json

**Files:**
- Create: `apps/pos/package.json`

- [ ] **Step 1: Write the file**

```json
{
  "name": "@senku/pos",
  "version": "0.0.1",
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 8080",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@clerk/nextjs": "^6.9.0",
    "@senku/types": "workspace:*",
    "@senku/ui": "workspace:*",
    "drizzle-orm": "^0.38.3",
    "next": "^15.1.3",
    "pg": "^8.13.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@types/pg": "^8.11.10",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "drizzle-kit": "^0.30.1",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls apps/pos/package.json`
Expected: file listed

---

### Task 2: TypeScript + Next.js config

**Files:**
- Create: `apps/pos/tsconfig.json`
- Create: `apps/pos/next.config.ts`

- [ ] **Step 1: Write tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "allowJs": true,
    "noEmit": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Write next.config.ts**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

---

### Task 3: Tailwind CSS config

**Files:**
- Create: `apps/pos/tailwind.config.ts`
- Create: `apps/pos/postcss.config.mjs`

- [ ] **Step 1: Write tailwind.config.ts**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:    '#080D1A',
          navy:    '#0F1A35',
          teal:    '#06B6D4',
          amber:   '#F0ABFC',
          blue:    '#8B5CF6',
          surface: '#F0F9FF',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Write postcss.config.mjs**

```mjs
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

export default config
```

---

### Task 4: Drizzle config

**Files:**
- Create: `apps/pos/drizzle.config.ts`

- [ ] **Step 1: Write drizzle.config.ts**

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

---

### Task 5: Environment variables

**Files:**
- Create: `apps/pos/.env.example`

- [ ] **Step 1: Write .env.example**

```
# Clerk — same key as gosenku.com (satellite)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=https://gosenku.com/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=https://gosenku.com/sign-up

# senku_pos — own DB (NOT shared with gosenku.com)
DATABASE_URL=postgresql://user:pass@localhost:5432/senku_pos

# gosenku.com internal API secret (same value both sides)
INTERNAL_API_SECRET=secret_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3001
NODE_ENV=development
```

---

### Task 6: Drizzle DB schema

**Files:**
- Create: `apps/pos/src/db/schema/products.ts`
- Create: `apps/pos/src/db/schema/sales.ts`
- Create: `apps/pos/src/db/schema/sale-items.ts`
- Create: `apps/pos/src/db/schema/cash-sessions.ts`
- Create: `apps/pos/src/db/schema/index.ts`
- Create: `apps/pos/src/db/index.ts`

- [ ] **Step 1: Write products.ts**

```ts
import { boolean, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const products = pgTable('products', {
  id:          uuid('id').primaryKey().defaultRandom(),
  businessId:  uuid('business_id').notNull(),
  name:        text('name').notNull(),
  description: text('description'),
  price:       numeric('price', { precision: 10, scale: 2 }).notNull(),
  category:    text('category'),
  sku:         text('sku'),
  stock:       text('stock'),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Product = typeof products.$inferSelect
export type NewProduct = typeof products.$inferInsert
```

- [ ] **Step 2: Write sales.ts**

```ts
import { integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const sales = pgTable('sales', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  businessId:          uuid('business_id').notNull(),
  cashierId:           text('cashier_id').notNull(),
  customerId:          text('customer_id'),
  total:               numeric('total', { precision: 10, scale: 2 }).notNull(),
  paymentMethod:       text('payment_method').notNull(),
  status:              text('status').notNull().default('completed'),
  loyaltyPointsIssued: integer('loyalty_points_issued').default(0),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Sale = typeof sales.$inferSelect
export type NewSale = typeof sales.$inferInsert
```

- [ ] **Step 3: Write sale-items.ts**

```ts
import { integer, numeric, pgTable, uuid } from 'drizzle-orm/pg-core'
import { sales } from './sales'
import { products } from './products'

export const saleItems = pgTable('sale_items', {
  id:        uuid('id').primaryKey().defaultRandom(),
  saleId:    uuid('sale_id').notNull().references(() => sales.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  quantity:  integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal:  numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
})

export type SaleItem = typeof saleItems.$inferSelect
export type NewSaleItem = typeof saleItems.$inferInsert
```

- [ ] **Step 4: Write cash-sessions.ts**

```ts
import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const cashSessions = pgTable('cash_sessions', {
  id:              uuid('id').primaryKey().defaultRandom(),
  businessId:      uuid('business_id').notNull(),
  cashierId:       text('cashier_id').notNull(),
  openedAt:        timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt:        timestamp('closed_at', { withTimezone: true }),
  openingBalance:  numeric('opening_balance', { precision: 10, scale: 2 }).notNull(),
  closingBalance:  numeric('closing_balance', { precision: 10, scale: 2 }),
  totalSales:      numeric('total_sales', { precision: 10, scale: 2 }),
  status:          text('status').notNull().default('open'),
})

export type CashSession = typeof cashSessions.$inferSelect
export type NewCashSession = typeof cashSessions.$inferInsert
```

- [ ] **Step 5: Write schema/index.ts**

```ts
export * from './products'
export * from './sales'
export * from './sale-items'
export * from './cash-sessions'
```

- [ ] **Step 6: Write db/index.ts**

```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const db = drizzle(pool, { schema })
```

---

### Task 7: gosenku.com internal API helper

**Files:**
- Create: `apps/pos/src/lib/root-api.ts`

- [ ] **Step 1: Write root-api.ts**

```ts
const ROOT_API = 'https://gosenku.com/api/internal'

const headers = {
  Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
  'Content-Type': 'application/json',
}

export async function checkPosAccess(userId: string, businessId: string) {
  const res = await fetch(
    `${ROOT_API}/check-access?userId=${userId}&app=pos&businessId=${businessId}`,
    { headers, cache: 'no-store' },
  )
  return res.json() as Promise<{ allowed: boolean; reason?: string }>
}

export async function getSession(userId: string, businessId?: string) {
  const params = new URLSearchParams({ userId })
  if (businessId) params.set('businessId', businessId)
  const res = await fetch(`${ROOT_API}/session?${params}`, { headers, cache: 'no-store' })
  return res.json()
}
```

---

### Task 8: Middleware

**Files:**
- Create: `apps/pos/src/middleware.ts`

- [ ] **Step 1: Write middleware.ts**

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/api/health'])

export default clerkMiddleware(async (auth, request) => {
  const { userId, sessionClaims } = await auth()
  const response = NextResponse.next()

  if (isPublicRoute(request)) return response

  if (!userId) {
    const signInUrl = new URL('https://gosenku.com/sign-in')
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }

  const role = (sessionClaims?.publicMetadata as Record<string, string>)?.role
  if (role !== 'business' && role !== 'superadmin' && role !== 'cashier') {
    return NextResponse.redirect(new URL('https://gosenku.com/hub'))
  }

  return response
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|ttf|otf)$).*)',
  ],
}
```

---

### Task 9: App layout + globals

**Files:**
- Create: `apps/pos/src/app/globals.css`
- Create: `apps/pos/src/app/layout.tsx`
- Create: `apps/pos/src/app/page.tsx`

- [ ] **Step 1: Write globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=DM+Mono:wght@400;500&display=swap');

:root {
  --brand-dark:    #080D1A;
  --brand-navy:    #0F1A35;
  --brand-teal:    #06B6D4;
  --brand-amber:   #F0ABFC;
  --brand-blue:    #8B5CF6;
  --brand-surface: #F0F9FF;
}

html, body {
  background-color: var(--brand-dark);
  color: var(--brand-surface);
  font-family: 'DM Sans', sans-serif;
}
```

- [ ] **Step 2: Write layout.tsx**

```tsx
import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Senku POS',
  description: 'Sistema de punto de venta — Senku',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      isSatellite
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL}
      signInFallbackRedirectUrl={process.env.NEXT_PUBLIC_APP_URL}
      signUpFallbackRedirectUrl="https://gosenku.com/hub"
    >
      <html lang="es">
        <body className="font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

- [ ] **Step 3: Write app/page.tsx (redirect to /pos)**

```tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/pos')
}
```

---

### Task 10: POS route group

**Files:**
- Create: `apps/pos/src/app/(pos)/layout.tsx`
- Create: `apps/pos/src/app/(pos)/pos/page.tsx`

- [ ] **Step 1: Write (pos)/layout.tsx**

```tsx
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-dark">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Write (pos)/pos/page.tsx**

```tsx
export default function PosPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-brand-teal">Senku POS</h1>
        <p className="mt-2 text-brand-surface/60">Terminal de venta — en construcción</p>
      </div>
    </div>
  )
}
```

---

### Task 11: API routes

**Files:**
- Create: `apps/pos/src/app/api/health/route.ts`
- Create: `apps/pos/src/app/api/session/route.ts`

- [ ] **Step 1: Write health/route.ts**

```ts
import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({ status: 'ok', ts: new Date().toISOString() })
}
```

- [ ] **Step 2: Write session/route.ts**

```ts
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/root-api'
import { cookies } from 'next/headers'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cookieStore = await cookies()
  const activeBusinessId = cookieStore.get('senku_pos_active_business')?.value

  const session = await getSession(userId, activeBusinessId)
  return NextResponse.json(session)
}
```

---

### Task 12: POS session context

**Files:**
- Create: `apps/pos/src/context/pos-session-context.tsx`

- [ ] **Step 1: Write pos-session-context.tsx**

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface Business {
  id: string
  name: string
  role: string
}

interface PosSession {
  userId: string
  businesses: Business[]
  activeBusiness: Business | null
  loading: boolean
}

const PosSessionContext = createContext<PosSession>({
  userId: '',
  businesses: [],
  activeBusiness: null,
  loading: true,
})

export function PosSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<PosSession>({
    userId: '',
    businesses: [],
    activeBusiness: null,
    loading: true,
  })

  useEffect(() => {
    fetch('/api/session')
      .then((r) => r.json())
      .then((data) => {
        setSession({
          userId: data.userId ?? '',
          businesses: data.businesses ?? [],
          activeBusiness: data.activeBusiness ?? null,
          loading: false,
        })
      })
      .catch(() => setSession((s) => ({ ...s, loading: false })))
  }, [])

  return <PosSessionContext.Provider value={session}>{children}</PosSessionContext.Provider>
}

export const usePosSession = () => useContext(PosSessionContext)
```

---

### Task 13: Dockerfile

**Files:**
- Create: `apps/pos/Dockerfile`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY apps/pos/package.json ./apps/pos/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps/pos/node_modules ./apps/pos/node_modules
COPY . .
RUN pnpm --filter @senku/pos build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/apps/pos/.next/standalone ./
COPY --from=builder /app/apps/pos/.next/static ./apps/pos/.next/static
COPY --from=builder /app/apps/pos/public ./apps/pos/public

EXPOSE 8080
CMD ["node", "apps/pos/server.js"]
```

---

### Task 14: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy-prod.yml`

- [ ] **Step 1: Write deploy-prod.yml**

```yaml
name: Deploy to Production

on:
  push:
    branches: [production]
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: 882788449114.dkr.ecr.us-east-1.amazonaws.com
  ECR_REPOSITORY: senku-pos
  APP_RUNNER_SERVICE: senku-pos-prod

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push image
        run: |
          IMAGE_TAG=${{ github.sha }}
          docker build -f apps/pos/Dockerfile \
            --build-arg NEXT_PUBLIC_APP_URL=https://pos.gosenku.com \
            --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }} \
            --build-arg NEXT_PUBLIC_CLERK_SIGN_IN_URL=https://gosenku.com/sign-in \
            --build-arg NEXT_PUBLIC_CLERK_SIGN_UP_URL=https://gosenku.com/sign-up \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
            -t $ECR_REGISTRY/$ECR_REPOSITORY:latest \
            .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Deploy to App Runner
        run: |
          aws apprunner start-deployment \
            --service-arn $(aws apprunner list-services \
              --query "ServiceSummaryList[?ServiceName=='$APP_RUNNER_SERVICE'].ServiceArn" \
              --output text)
```

---

### Task 15: Update root package.json + verify

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Update root scripts**

```json
{
  "scripts": {
    "dev": "pnpm --filter @senku/pos dev",
    "build": "pnpm --filter @senku/pos build",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint .",
    "format": "prettier --write .",
    "db:generate": "pnpm --filter @senku/pos db:generate",
    "db:migrate": "pnpm --filter @senku/pos db:migrate",
    "db:studio": "pnpm --filter @senku/pos db:studio"
  }
}
```

- [ ] **Step 2: Run pnpm install**

```
pnpm install
```

Expected: no errors, lockfile updated

- [ ] **Step 3: Run typecheck**

```
pnpm typecheck
```

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: scaffold apps/pos — Next.js 15 + Drizzle + Tailwind + Clerk satellite"
```
