# Senku POS — Project Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir Senku POS completo — POS multi-tenant para restaurantes costarricenses con Comandeo, KDS, Cajero, lealtad y Factura Electrónica.

**Architecture:** Monorepo pnpm con tres apps (`api` Fastify, `pos` React PWA, `dashboard` Next.js) compartiendo `packages/db` (Prisma) y `packages/types`. Multi-tenancy por `tenantId` en JWT — toda query lo filtra. Comunicación POS↔KDS via WebSocket/SSE desde el API.

**Tech Stack:** pnpm 9, TypeScript 5.7, Fastify 4, React 18 + Vite 5, Next.js 14, Prisma 5, PostgreSQL, BullMQ, Redis, vite-plugin-pwa, Clerk (satellite), AWS App Runner + ECR, AWS Secrets Manager, AWS ElastiCache

## Role System

**Tier 1 — Clerk global** (`publicMetadata.role`) — controla entrada a la app:

| Clerk role | Acceso POS |
|---|---|
| `superadmin` | Total |
| `business` | Sí — owner/admin |
| `cashier` | Sí — staff operativo |
| `customer` | No → gosenku.com/hub |

**Tier 2 — Membership** (`business_memberships.role`) — controla pantallas:

| Membership role | Comandeo | KDS | Cajero | Admin |
|---|---|---|---|---|
| `owner` | ✓ | ✓ | ✓ | ✓ |
| `admin` | ✓ | ✓ | ✓ | ✓ sin billing |
| `cashier` | ✓ | ✓ vista | ✓ | ✗ |
| `waiter` | ✓ | ✗ | ✗ | ✗ |
| `kitchen` | ✗ | ✓ | ✗ | ✗ |

`waiter` y `kitchen` son nuevos valores en `business_memberships.role` — no existen en Loyalty (que solo usa `owner/admin/cashier`), pero no colisionan.

---

## Dependency Graph

```
Phase 0 (Monorepo)
  └─→ Phase 1 (API Auth)
        ├─→ Phase 2 (Comandeo POS)
        │     └─→ Phase 3 (KDS)
        │           └─→ Phase 4 (Cajero)
        │                 └─→ Phase 5 (Food Court)
        │                 └─→ Phase 7 (Factura Electrónica)
        └─→ Phase 6 (Dashboard)
Phase 2 ──→ Phase 8 (PWA Offline)
```

**Critical path:** Phase 0 → 1 → 2 → 3 → 4

---

## Phase 0: Monorepo Foundation

> Plan detallado: [`2026-05-23-monorepo-setup.md`](2026-05-23-monorepo-setup.md)

**Goal:** Workspace funcional con schema Prisma completo, TypeScript estricto y datos de prueba listos.

- [ ] Ejecutar el plan `2026-05-23-monorepo-setup.md` completo (Tasks 1–10)
- [ ] PostgreSQL corriendo localmente, `apps/api/.env` configurado con `DATABASE_URL`
- [ ] `pnpm install` sin errores
- [ ] `pnpm db:migrate` aplica el schema sin errores
- [ ] `pnpm db:seed` termina con `Seed completado: Soda El Senku lista para pruebas`
- [ ] `pnpm typecheck` pasa en todos los paquetes
- [ ] `pnpm lint` pasa con 0 warnings
- [ ] `GET http://localhost:3001/health` responde `{ "status": "ok" }`

---

## Phase 1: Auth — Clerk Satellite + Business Session

> Plan detallado: `docs/superpowers/plans/2026-05-24-auth-clerk.md` *(por escribir)*

**Goal:** pos.gosenku.com funciona como satellite de Clerk con sesión compartida desde gosenku.com; el middleware bloquea accesos no autorizados; cada request del POS lleva `businessId` validado.

**Bloqueantes:** Phase 0 completa.

**Arquitectura:** Usuarios se autentican en `gosenku.com/sign-in` (PRIMARY). La sesión se comparte via cookie en `.gosenku.com`. pos.gosenku.com verifica la sesión como SATELLITE de Clerk sin tener su propio login. El `businessId` activo se resuelve via `business_memberships` y se persiste en cookie/session context (mismo patrón que loyalty.gosenku.com).

### Tasks — Next.js app (pos.gosenku.com = `apps/dashboard`)

- [ ] Instalar `@clerk/nextjs` en `apps/dashboard`
- [ ] Variables de entorno: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- [ ] `app/layout.tsx` — wrappear con `<ClerkProvider isSatellite signInUrl="https://gosenku.com/sign-in" signUpUrl="https://gosenku.com/sign-up" signInFallbackRedirectUrl="https://pos.gosenku.com" signUpFallbackRedirectUrl="https://gosenku.com/hub">`
- [ ] `middleware.ts` — implementar el clerkMiddleware con:
  - Rutas públicas: `/api/webhooks/(.*)`, `/health`
  - Sin userId → `redirectToSignIn()`
  - `!['superadmin', 'business', 'cashier'].includes(role)` → redirect a `https://gosenku.com/hub`
  - Rutas de admin (`/admin`, `/menu`, `/reportes`) → requerir `business` o `superadmin` en membership
  - Rutas de kitchen (`/kds`) → permitir `kitchen`, `cashier`, `admin`, `owner`
  - Rutas de comandeo (`/comandeo`) → bloquear solo `customer`
- [ ] `GET /api/session` — Server Action o Route Handler que resuelve el `businessId` activo del usuario via `business_memberships`, verifica suscripción POS en `business_app_subscriptions`, retorna `{ businessId, businessName, role }`
- [ ] `BusinessSessionProvider` — Client Component que llama `/api/session` al montar y expone `{ businessId, businessName, role }` via Context; persiste en cookie para evitar re-fetch en cada carga
- [ ] `useBusinessSession()` hook — consume el Context; throws si `businessId` es null

### Tasks — Fastify API (`apps/api`)

- [ ] Instalar `@clerk/backend` en `apps/api`
- [ ] Plugin `authenticate` — extrae el Bearer token del header `Authorization`, lo verifica con `verifyToken()` de `@clerk/backend` usando `CLERK_SECRET_KEY`; decora `request` con `{ clerkUserId, clerkRole }`
- [ ] Guard `requireBusiness` — verifica via DB que el `businessId` del request body/param existe en `business_memberships` para el `clerkUserId`; retorna 403 si no
- [ ] `GET /locations?businessId=` — sucursales del negocio (incluye `hasTableManagement`)
- [ ] `GET /locations/:locationId/tables` — mesas con `status` y `capacity`
- [ ] `GET /menu/categories?businessId=` — categorías con `menuItems[]`
- [ ] `GET /menu/items/:id/modifiers` — modificadores con `required` y `priceDelta`
- [ ] Tests de integración:
  - Token Clerk inválido → 401
  - Token válido pero sin membresía en el negocio → 403
  - `GET /locations` → filtra correctamente por `businessId`

---

## Phase 2: POS App — Shell + Comandeo

> Plan detallado: `docs/superpowers/plans/2026-05-24-pos-comandeo.md` *(por escribir)*

**Goal:** App React arranca con auth, detecta el modo de la sucursal (`hasTableManagement`) y muestra el Comandeo completo: Vista de Piso visual + Vista de Orden con modifiers, enviando la comanda al API.

**Bloqueantes:** Phase 1 completa.

### Tasks

**Shell**
- [ ] React Router 6 — rutas: `/login`, `/comandeo`, `/kds`, `/cajero`
- [ ] `AuthContext` — almacena JWT, lo inyecta en cada `fetch`, redirige a `/login` si 401
- [ ] `LocationContext` — carga `hasTableManagement` y datos de la sucursal activa; si `false` redirige `/cajero` al arrancar

**Comandeo — Fase 1: Vista de Piso**
- [ ] `FloorCanvas` component — carga `GET /locations/:id/tables` y renderiza mesas del API (no hardcodeadas)
  - Circular icon + chair dots por `table.capacity`: 2 → (270°/90°), 4 → (315°/45°/135°/225°), 6 → (60° intervals desde 270°)
  - Fill sólido por status: libre `#22C55E`, occ `#F59E0B`, urg `#EF4444`; sillas en pastel
  - Canvas fondo `#F8F9FB` con grid lines; zone labels en negro uppercase (V1 hardcoded por location)
  - Click en mesa → navega a `/comandeo/:tableId`
- [ ] Botón "+ Nueva orden" → channel picker (Mesa / Para llevar / Delivery)
- [ ] Para llevar y Delivery → Vista de Orden sin `tableId`, con header "Llevar #003" / "Delivery #007"

**Comandeo — Fase 2: Vista de Orden**
- [ ] `OrderView` component — recibe `tableId` (nullable para takeout/delivery)
- [ ] Header: `← Piso` | nombre mesa + mesero + timer | [Dividir] [Descuento] [Cobrar →]
- [ ] Category tabs horizontal — carga del API
- [ ] Item grid 3 columnas — tap abre `ModifierPicker`
- [ ] `ModifierPicker` — muestra modificadores predefinidos del item + campo notas libre; required modifiers bloquean el confirm si no están seleccionados
- [ ] Live order summary — subtotal, IVA 13%, total en ₡
- [ ] "Enviar a cocina" → `POST /orders` con `{ tableId, channel, items: [{ menuItemId, quantity, modifiers, notes }] }`; en éxito muestra toast y limpia el summary

**Tests**
- [ ] `FloorCanvas` renderiza el número correcto de mesas según respuesta del API
- [ ] `ModifierPicker` bloquea confirm si modifier requerido no seleccionado
- [ ] `POST /orders` enviado con payload correcto al tap "Enviar a cocina"

---

## Phase 3: KDS — Kitchen Display System

> Plan detallado: `docs/superpowers/plans/2026-05-24-kds.md` *(por escribir)*

**Goal:** Órdenes de Comandeo aparecen en KDS en tiempo real; la cocina puede avanzar el estado de cada orden.

**Bloqueantes:** Phase 2 completa (necesita órdenes reales en la BD).

### Tasks

**API**
- [ ] `GET /kds/orders?locationId=` — órdenes activas (status `PENDING` | `IN_PROGRESS`), con items, modifiers y notes
- [ ] `PATCH /orders/:id/status` — transiciones: `PENDING → IN_PROGRESS → READY`; valida que no salte estados
- [ ] SSE endpoint `GET /kds/stream?locationId=` — emite evento `order-updated` en cada cambio de status; el POS KDS se suscribe al montar

**KDS UI (`/kds`)**
- [ ] `KDSScreen` — grilla de `KDSCard`, se suscribe al SSE y actualiza sin reload
- [ ] `KDSCard` component:
  - Fondo blanco `#ffffff`, `border-top: 4px solid` por status: amber=Pendiente, blue=En Preparación, green=Listo
  - Fondo + border rojos si timer > 15 min
  - Timer semáforo: verde <8min, amber 8–15min, rojo >15min (actualiza cada segundo)
  - Channel badge: "Mesa 1" / "🥡 Llevar #003" / "🛵 Delivery #007"
  - Items con modifier names + notes en italic bajo el nombre
  - Botón acción: "Iniciar" (PENDING→IN_PROGRESS), "Listo" (IN_PROGRESS→READY)

**Tests**
- [ ] `PATCH /orders/:id/status` con status inválido → 400
- [ ] SSE emite evento al cambiar status de una orden
- [ ] `KDSCard` muestra borde rojo cuando `elapsedMinutes > 15`

---

## Phase 4: Cajero — Payment & Loyalty

> Plan detallado: `docs/superpowers/plans/2026-05-24-cajero.md` *(por escribir)*

**Goal:** El cajero cobra la mesa, aplica puntos de lealtad y registra el pago. El toggle de Factura Electrónica encola el job sin bloquear el cierre.

**Bloqueantes:** Phase 3 (el cajero opera sobre órdenes ya enviadas a cocina).

### Tasks

**API**
- [ ] `GET /orders/:id` — orden completa con items, modifiers, totals calculados
- [ ] `GET /customers?phone=` — lookup de cliente por teléfono; retorna `{ id, name, loyaltyPoints }`
- [ ] `POST /invoices` — finaliza orden:
  - Calcula `discount` si hay puntos canjeados
  - Crea `Invoice` con `paymentMethod`, `total`, `discount`
  - Crea `LoyaltyTransaction` (puntos ganados + canjeados)
  - Actualiza `Order.status = DELIVERED`
  - Si `emitirFactura: true` → encola job BullMQ `emit-invoice` (no espera)
  - Retorna `{ invoiceId, orderNumber, change }` para imprimir

**Cajero UI (`/cajero`)**
- [ ] Layout: panel izquierdo (resumen de orden + loyalty) | panel derecho (pago)
- [ ] Panel izquierdo: lista de items con modifiers y notes, subtotal / IVA / total
- [ ] Customer lookup: input teléfono → muestra nombre, puntos actuales, puntos por esta visita, nuevo saldo
- [ ] "Canjear puntos" → aplica descuento al total antes de cobrar
- [ ] Payment tabs: **Efectivo** (input monto entregado, vuelto calculado en tiempo real) / **Tarjeta** / **SINPE**
- [ ] Toggle "Emitir Factura Electrónica"
- [ ] Botón COBRAR → `POST /invoices`; en éxito muestra pantalla de confirmación con número de orden y vuelto

**Tests**
- [ ] `POST /invoices` con puntos canjeados → `discount` correcto en BD
- [ ] `POST /invoices` sin `emitirFactura` → no crea job BullMQ
- [ ] Vuelto calculado correctamente cuando efectivo > total
- [ ] COBRAR deshabilitado si método de pago no seleccionado

---

## Phase 5: Food Court Mode

> Plan detallado: `docs/superpowers/plans/2026-05-24-food-court.md` *(por escribir)*

**Goal:** Cuando `hasTableManagement=false`, el Cajero es ordering + payment en un solo paso; COBRAR dispara todo: pago, comanda a KDS y ticket con número secuencial.

**Bloqueantes:** Phase 4 completa.

### Tasks

**API**
- [ ] `Order.orderNumber` auto-incrementado por `locationId` al crear la orden cuando `hasTableManagement=false`
- [ ] `POST /orders` en modo food court: crea la orden con status `PENDING` Y crea el Invoice en la misma transacción (pago + comanda simultáneos)
- [ ] KDS recibe la orden igual que en modo mesa; muestra `#047` en lugar de "Mesa X"

**Cajero UI — variante food court**
- [ ] `LocationContext.hasTableManagement === false` → panel izquierdo se convierte en selector de items (reutiliza `OrderView` del Comandeo)
- [ ] Modifier picker reutilizado sin cambios
- [ ] COBRAR hace las 3 acciones: procesa pago, envía comanda al KDS, imprime ticket "#047"
- [ ] No hay paso separado de "Enviar a cocina"

**Tests**
- [ ] `POST /orders` en food court → `orderNumber` incrementa por location
- [ ] COBRAR en food court → Order creada + Invoice creado + job KDS en una sola request
- [ ] KDS muestra `#047` en el card cuando no hay mesa asignada

---

## Phase 6: Dashboard — Tenant Admin

> Plan detallado: `docs/superpowers/plans/2026-05-24-dashboard.md` *(por escribir)*

**Goal:** El dueño configura su restaurante, gestiona sucursales, usuarios y menú desde el Dashboard web.

**Bloqueantes:** Phase 1 (necesita auth API).

### Tasks

- [ ] Next.js App Router — auth ya resuelta por Clerk satellite (Phase 1); esta fase es solo el contenido admin
- [ ] Acceso protegido por el mismo middleware de Phase 1 — solo `business` y `superadmin`
- [ ] **Onboarding wizard** (3 pasos): Crear Tenant → Crear Location (con toggle "¿Manejo de mesas?") → Crear primer usuario admin
- [ ] **Sucursales**: listar, crear, editar (nombre, dirección, toggle `hasTableManagement`)
- [ ] **Mesas**: listar por sucursal, crear (nombre + capacity: 2/4/6), editar, eliminar
- [ ] **Menú**: categorías (orden arrastrable), items (nombre, precio, costo, tiempo prep, imagen), modifiers por item (nombre, priceDelta, required)
- [ ] **Usuarios**: listar, invitar por email, asignar rol (OWNER / MANAGER / WAITER / CASHIER / KITCHEN)
- [ ] **Reportes básicos**: ventas del día por sucursal, top 5 items vendidos, promedio de ticket

---

## Phase 7: Factura Electrónica 4.4

> Plan detallado: `docs/superpowers/plans/2026-05-24-factura-electronica.md` *(por escribir)*

**Goal:** Los Invoices marcados se envían a Hacienda de forma asíncrona, firmados con el `.p12` del negocio almacenado en AWS Secrets Manager.

**Bloqueantes:** Phase 4 (necesita `Invoice` en BD).

### Tasks

- [ ] Redis (AWS ElastiCache) + BullMQ worker en `apps/api` — procesa jobs `emit-invoice`
- [ ] Genera XML FE 4.4 válido (clave numérica, emisor, receptor, líneas de detalle, impuestos, totales)
- [ ] Recupera certificado `.p12` del negocio desde **AWS Secrets Manager** (`senku/prod/fe-cert/{businessId}`)
- [ ] Firma XML con el `.p12` usando `node-forge`
- [ ] Envía a ATV de Hacienda (`POST https://api-sandbox.comprobanteselectronicos.go.cr/recepcion/v1/recepcion`)
- [ ] Actualiza `Invoice.status`: `PENDING_FE → FE_ACCEPTED | FE_REJECTED`
- [ ] Reintento automático con backoff exponencial (max 3 intentos) en error transitorio
- [ ] Alerta en Dashboard si una FE queda en `FE_REJECTED`

---

## Phase 8: PWA + Offline

> Plan detallado: `docs/superpowers/plans/2026-05-24-pwa-offline.md` *(por escribir)*

**Goal:** El POS funciona sin internet. Las órdenes se guardan en IndexedDB y se sincronizan al recuperar conexión.

**Bloqueantes:** Phase 2 (necesita el shell del POS estable).

### Tasks

- [ ] `vite-plugin-pwa` configurado — manifest con nombre "Senku POS", iconos, `display: standalone`, `theme_color: #0F1F35`
- [ ] Workbox strategy: `CacheFirst` para assets estáticos, `NetworkFirst` para llamadas al API
- [ ] `useOnlineStatus` hook — detecta `online`/`offline` y expone el estado en contexto
- [ ] Dexie.js para IndexedDB — tablas: `pendingOrders`, `cachedMenu`, `cachedTables`
- [ ] Al crear orden offline → guarda en `pendingOrders` con timestamp
- [ ] Sync worker — al volver online, envía `pendingOrders` al API en orden FIFO; elimina los exitosos
- [ ] Banner de estado offline en el POS — barra roja superior: "Sin conexión — X órdenes pendientes de sync"
- [ ] Al recuperar conexión → sync automático + toast de confirmación

---

## Spec Coverage Checklist

| Requisito | Fase |
|---|---|
| Multi-tenancy con `tenantId` en todo query | Phase 1 |
| Floor plan visual con sillas por capacidad | Phase 2 |
| Channel picker: Mesa / Llevar / Delivery | Phase 2 |
| `hasTableManagement` branching en POS | Phase 2 + 5 |
| Modifiers predefinidos + notas libres | Phase 2 |
| KDS tiempo real + timer semáforo | Phase 3 |
| KDS cards: blancas, border-top por status | Phase 3 |
| Cajero: Efectivo / Tarjeta / SINPE + vuelto | Phase 4 |
| Loyalty: lookup + canjear puntos | Phase 4 |
| Factura Electrónica toggle (async) | Phase 4 + 7 |
| Post-payment modification V1: manager PIN + void | Phase 4 |
| Food court: COBRAR = pago + KDS + ticket | Phase 5 |
| Dashboard: onboarding, mesas, menú, usuarios | Phase 6 |
| FE 4.4 firmada con .p12 en AWS Secrets Manager | Phase 7 |
| PWA offline con sync queue | Phase 8 |
