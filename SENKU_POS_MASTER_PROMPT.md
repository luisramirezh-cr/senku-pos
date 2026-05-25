# SENKU POS — Prompt Maestro para Claude Code

Usá este documento al inicio de cada sesión de Claude Code. Pegalo completo o referencialo con `@SENKU_POS_MASTER_PROMPT.md` si lo tenés en el repo.

---

## 🧠 Contexto del Proyecto

Estás construyendo **Senku POS**, un sistema de punto de venta cloud para restaurantes en Costa Rica. Es un producto SaaS bootstrapped, construido en solitario con Claude Code como equipo de desarrollo. La velocidad y la calidad del código importan por igual — cada decisión técnica debe ser sostenible a largo plazo sin un equipo grande.

Senku POS es parte de un ecosistema mayor llamado **Senku**, que ya tiene un producto en producción: **Senku Lealtad** (programa de puntos y fidelización para restaurantes). La integración entre ambos productos es el principal diferenciador competitivo.

### Producto hermano: Senku Lealtad
- Stack: React + Node.js + PostgreSQL
- Ya en producción con usuarios activos
- Senku POS debe integrarse con Senku Lealtad vía API interna
- Toda venta procesada en el POS debe poder acumular puntos en Senku Lealtad automáticamente
- El cliente (restaurante) usa ambos productos con una sola cuenta

---

## 🎯 Qué es Senku POS

Un POS cloud especializado para restaurantes costarricenses que combina:

1. **Operación completa** — comandeo en mesa, KDS de cocina, facturación electrónica
2. **Inteligencia de negocio** — analytics de rentabilidad por platillo, proyecciones, alertas
3. **Fidelización nativa** — integración directa con Senku Lealtad sin fricción

### Mercado objetivo
- Restaurantes en Costa Rica, 1 a 20 sucursales
- Dueño involucrado en operación diaria
- Actualmente en POS básico o sin POS especializado
- Precio objetivo: $49–$89/mes por sucursal

### Competidores principales a superar
- **MOZZO** — mejor posicionado, pero sin lealtad nativa y precio alto
- **Piatto / PosHat** — locales, pero UX desactualizado y sin analytics
- **Alegra** — genérico, no especializado en restaurante
- **Toast (USA)** — referente de features (especialmente Toast IQ con IA), pero sin localización CR

---

## 🏗️ Arquitectura Técnica

### Stack definido

| Capa | Tecnología | Razón |
|------|-----------|-------|
| Frontend web (admin/dashboard) | Next.js 14 (App Router) | SSR para dashboard, consistencia con ecosistema React |
| Frontend POS (terminal) | React + Vite (PWA) | Modo offline, instalable en tablet como app |
| Backend API | Node.js + Fastify | Mismo stack que Senku Lealtad, alta performance |
| Base de datos principal | PostgreSQL 15 | Consistencia con Senku Lealtad, transacciones ACID |
| Cache / real-time | Redis | Sincronización en tiempo real entre terminales |
| Cola de mensajes | BullMQ (sobre Redis) | Jobs async: facturación electrónica, sync Hacienda |
| ORM | Prisma | Type-safe, migraciones confiables |
| Autenticación | JWT + Refresh tokens | Stateless, compatible con modo offline |
| Infraestructura | Google Cloud Platform | Cloud Run (API), Cloud SQL (PostgreSQL), Cloud Storage |
| CI/CD | GitHub Actions → Cloud Run | Deploy automático en push a main |

### Estructura de monorepo

```
senku-pos/
├── apps/
│   ├── api/              # Fastify API (Node.js)
│   ├── pos/              # Terminal POS (React PWA)
│   └── dashboard/        # Panel admin (Next.js)
├── packages/
│   ├── db/               # Prisma schema + client compartido
│   ├── types/            # TypeScript types compartidos
│   └── ui/               # Componentes compartidos entre apps
├── infra/                # Terraform / Cloud configs
└── docs/                 # PRDs, decisiones de arquitectura
```

Usar **pnpm workspaces** para el monorepo.

### Base de datos — esquema central

Las tablas principales que deben existir desde el inicio:

```sql
-- Multi-tenant: cada restaurante es un "tenant"
tenants (id, name, ruc, plan, created_at)

-- Sucursales del restaurante
locations (id, tenant_id, name, address, timezone)

-- Usuarios del sistema (dueños, saloneros, cocineros)
users (id, tenant_id, email, role, hashed_password)

-- Menú
categories (id, tenant_id, name, sort_order)
menu_items (id, tenant_id, category_id, name, price, cost, prep_time_minutes, active)
modifiers (id, menu_item_id, name, price_delta)

-- Operación
tables (id, location_id, name, capacity, status)
orders (id, location_id, table_id, user_id, status, channel, created_at)
order_items (id, order_id, menu_item_id, qty, unit_price, notes, status)

-- Facturación
invoices (id, order_id, tenant_id, hacienda_key, xml_sent, pdf_url, total, tax, status)

-- Integración Senku Lealtad
loyalty_transactions (id, order_id, customer_id, points_earned, synced_at)
```

---

## 🇨🇷 Requisitos Legales Costa Rica

### Factura Electrónica 4.4 (CRÍTICO)
- Obligatoria desde 1 septiembre 2025 (Decreto N° 44739-H)
- Cada venta genera un comprobante electrónico firmado digitalmente
- Se envía al sistema de Hacienda (API DGT) en tiempo real
- Si falla la conexión: modo contingencia → sync cuando vuelva internet
- Campos obligatorios: emisor, receptor (opcional para consumidor final), detalle de líneas, impuestos (IVA 13%), clave numérica única de 50 dígitos
- Formato: XML firmado con certificado digital del contribuyente

### Implementación recomendada
- Usar librería `facturador-cr` o integración directa con API de Hacienda
- Job async con BullMQ para el envío (no bloquear la venta)
- Fallback a tiquete provisional si Hacienda no responde en < 3 segundos
- Almacenar XML firmado en Cloud Storage

### IVA
- Tasa general: 13%
- Algunos alimentos básicos: 1% o exentos (verificar lista oficial)
- El POS debe permitir configurar tasa por ítem del menú

---

## 📱 Modo Offline (CRÍTICO para restaurantes)

El POS debe funcionar aunque se corte el internet. Esto es innegociable para restaurantes.

### Estrategia
- **PWA con Service Worker** — cachea assets y lógica de la app
- **IndexedDB local** — almacena menú, mesas, órdenes activas
- **Sync queue** — acumula operaciones offline y sincroniza cuando vuelve conexión
- **Indicador visual claro** — el salonero siempre sabe si está online/offline
- La factura electrónica puede quedar pendiente — se envía al reconectarse
- Las órdenes locales tienen ID temporal (UUID) que se reconcilia con el servidor

---

## 🔗 Integración con Senku Lealtad

### Flujo de integración
1. Al cerrar una orden en el POS, se dispara un evento `order.completed`
2. El API de Senku POS llama al endpoint de Senku Lealtad: `POST /api/integrations/pos/transaction`
3. Senku Lealtad acredita los puntos al cliente identificado
4. El POS muestra confirmación: "✓ X puntos acreditados a [cliente]"

### Identificación del cliente
- Por número de teléfono (más común en CR)
- Por QR de la app de Senku Lealtad
- Por búsqueda por nombre

### Contrato de API (acordar con Senku Lealtad)
```typescript
// Request
POST /api/integrations/pos/transaction
{
  apiKey: string,          // API key del restaurante
  orderId: string,         // ID de la orden en Senku POS
  totalAmount: number,     // Total en colones
  customerId?: string,     // ID del cliente en Senku Lealtad (si identificado)
  customerPhone?: string,  // Alternativa al ID
  items: Array<{
    name: string,
    qty: number,
    unitPrice: number
  }>
}

// Response
{
  success: boolean,
  pointsEarned: number,
  customerName: string,
  totalPoints: number,
  tierName: string         // ej: "Cliente Gold"
}
```

---

## 🎨 Diseño y UX

### Principios
- **Velocidad sobre todo** — un salonero en hora pico no puede esperar más de 200ms por cualquier acción
- **Error-proof** — confirmar acciones destructivas, nunca perder una orden
- **Tablet-first** — el POS se usa en tablets de 10", no en laptops
- **Funciona con un dedo** — targets táctiles mínimo 44x44px

### Sistema de diseño (ya definido en prototipo)
```css
/* Colores principales */
--brand-dark: #0F1F35;
--brand-navy: #1A3355;
--brand-blue: #2563EB;
--brand-teal: #0D9488;   /* Color primario de acción */
--brand-amber: #F59E0B;
--brand-surface: #F8FAFC;

/* Tipografía */
font-family: 'DM Sans', sans-serif;  /* UI general */
font-family: 'DM Mono', monospace;   /* KDS, timestamps */
```

### Pantallas del prototipo ya aprobado
El prototipo React de referencia está en `docs/prototype/SenkuPOS.jsx`. Las 3 pantallas principales son el punto de partida de diseño:
1. **Comandeo** — selección de mesa, menú por categoría, resumen de orden con IVA
2. **KDS (Kitchen Display)** — vista oscura para cocina, semáforo por estado, tiempos
3. **Dashboard + Senku Chef** — métricas en tiempo real, chat de IA con contexto del negocio

---

## 🤖 Senku Chef (IA)

El asistente de IA integrado en el dashboard. **No construir en V1.0** — es feature de V1.5.

### Cuando llegue el momento
- Usar **Anthropic API (Claude)** como modelo base
- System prompt con contexto del restaurante: ventas históricas, menú, inventario
- Respuestas en español costarricense natural
- Capacidad de ejecutar acciones: actualizar menú, lanzar campañas, ajustar turnos
- Preguntas example que debe responder bien:
  - "¿Cuál fue mi platillo más rentable esta semana?"
  - "¿Cuándo debo pedir más camarones?"
  - "Mandá un WhatsApp a los clientes inactivos"

---

## 📋 Roadmap de Construcción

### V1.0 — El core que genera revenue (Semanas 1-8)
- [ ] Setup monorepo (pnpm workspaces + TypeScript)
- [ ] Schema Prisma completo + migraciones iniciales
- [ ] Auth (registro de restaurante, login, roles: owner/waiter/cook)
- [ ] API: CRUD de menú (categorías, items, modificadores)
- [ ] API: gestión de mesas y órdenes
- [ ] API: factura electrónica 4.4 (async con BullMQ)
- [ ] PWA terminal POS (comandeo + modo offline)
- [ ] KDS pantalla cocina
- [ ] Integración básica Senku Lealtad (acumular puntos al cerrar orden)
- [ ] Dashboard básico (ventas del día, órdenes activas)
- [ ] Deploy en Google Cloud (Cloud Run + Cloud SQL)
- [ ] Multi-tenant completo (un restaurante no ve datos de otro)

### V1.5 — Diferenciación (Mes 3-4)
- [ ] Senku Chef IA v1 (preguntas sobre el negocio)
- [ ] Control de inventario y costo de recetas
- [ ] Integración Rappi (recepción de pedidos delivery)
- [ ] Reportes financieros avanzados (margen por platillo)
- [ ] Campañas automáticas Senku Lealtad desde POS

### V2.0 — Escala (Mes 6-8)
- [ ] Menú digital QR (cliente pide desde su teléfono)
- [ ] Integración Uber Eats
- [ ] Multi-sucursal con dashboard centralizado
- [ ] Reservaciones

---

## ⚙️ Convenciones de Código

### General
- **TypeScript estricto** en todo el proyecto (`strict: true`)
- **ESLint + Prettier** — correr antes de cada commit
- **Commits en español** para consistencia con el contexto del negocio
- Nombrar ramas: `feature/nombre-feature`, `fix/descripcion-bug`

### API (Fastify)
```typescript
// Estructura de respuesta estándar
type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: { code: string; message: string }
}

// Errores estandarizados
const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  HACIENDA_ERROR: 'HACIENDA_ERROR',
  LOYALTY_SYNC_ERROR: 'LOYALTY_SYNC_ERROR',
}
```

### Seguridad (innegociable)
- Toda ruta del API requiere JWT válido excepto `/auth/*` y `/health`
- Row-level security: cada query filtra por `tenant_id` del token
- **Nunca** exponer datos de un tenant a otro — es el error más grave posible en multi-tenant
- Variables sensibles solo en Secret Manager de GCP, nunca en código

### Testing
- Tests de integración para todos los endpoints del API
- Tests unitarios para lógica de facturación electrónica
- Test de modo offline en el POS antes de cada release

---

## 🚀 Cómo Empezar una Sesión de Claude Code

Al iniciar una sesión nueva, decir:

> "Contexto: proyecto Senku POS, leer @SENKU_POS_MASTER_PROMPT.md. Hoy vamos a trabajar en: [TAREA ESPECÍFICA]"

### Tareas de ejemplo para primeras sesiones
- "Setup inicial del monorepo con pnpm workspaces, TypeScript y estructura de carpetas definida"
- "Schema Prisma completo basado en las tablas del master prompt, con seed de datos de prueba"
- "Endpoint POST /api/orders con validación, persistencia y emisión de evento para facturación"
- "PWA del POS: pantalla de comandeo funcional con IndexedDB para modo offline"

---

## ✅ Decisiones Tomadas

Todas resueltas — Claude Code no debe cuestionarlas, solo implementarlas.

### 1. Certificados digitales de Hacienda
Cada restaurante **sube su propio certificado `.p12`** y credenciales de Hacienda al onboardearse. El sistema los almacena cifrados en **GCP Secret Manager**, referenciados por `tenant_id`. Nunca en base de datos ni en código.

```typescript
// Estructura en Secret Manager
`senku-pos/${tenantId}/hacienda-cert`      // archivo .p12 en base64
`senku-pos/${tenantId}/hacienda-pin`       // PIN del certificado
`senku-pos/${tenantId}/hacienda-user`      // usuario ATV
`senku-pos/${tenantId}/hacienda-password`  // contraseña ATV
```

El módulo de facturación carga las credenciales del tenant en runtime, nunca las cachea en memoria más de lo necesario.

### 2. Procesamiento de pagos con datáfono
**V1.0 solo registra** el método de pago (efectivo, tarjeta, SINPE, otro). El cajero cobra por su propio medio y confirma en el sistema. Integración real con EVERTEC/Credomatic va en V1.5.

Métodos a registrar en V1.0:
- Efectivo
- Tarjeta (sin integración, solo registro)
- SINPE Móvil
- Transferencia
- Cortesía / Sin cobro

### 3. URL del API de Senku Lealtad
Configurar como variable de entorno, no hardcodear:

```env
# .env.production
SENKU_LEALTAD_API_URL=https://api.gosenku.com   # confirmar con el equipo
SENKU_LEALTAD_API_KEY=sk_live_...               # API key de integración entre productos
```

### 4. Arquitectura de dominios — gosenku.com

El dominio raíz `gosenku.com` pertenece a Senku Lealtad. La estructura de dominios es:

| Dominio | Producto | Cloud Run service | Estado |
|---------|----------|-------------------|--------|
| `gosenku.com` | Landing (actualmente dentro de Senku Lealtad) | `senku-lealtad` | Existente |
| `lealtad.gosenku.com` | Senku Lealtad app | `senku-lealtad` | Existente |
| `pos.gosenku.com` | Dashboard admin del POS | `senku-pos-dashboard` | **Nuevo** |
| `terminal.gosenku.com` | Terminal salonero (PWA) | `senku-pos-terminal` | **Nuevo** |

**Evolución futura (cuando tenga sentido):**
- Separar el landing de Senku Lealtad a su propio Cloud Run `senku-landing`
- `gosenku.com` pasa a ser el hub de marketing del ecosistema completo
- No hacer esto hasta que el POS esté generando revenue y justifique la inversión

**CORS:** `pos.gosenku.com` y `terminal.gosenku.com` deben estar en la allowlist del API de Senku Lealtad.

---

## 🔐 Variables de Entorno — Referencia Completa

```env
# API (senku-pos-api / Cloud Run)
DATABASE_URL=postgresql://...              # Cloud SQL via Cloud SQL Auth Proxy
REDIS_URL=redis://...                      # Cloud Memorystore
JWT_SECRET=...                             # Secret Manager
JWT_REFRESH_SECRET=...                     # Secret Manager
SENKU_LEALTAD_API_URL=https://api.gosenku.com
SENKU_LEALTAD_API_KEY=...                  # Secret Manager
GCP_PROJECT_ID=senku-prod
GCP_STORAGE_BUCKET=senku-pos-documents    # Para XMLs de facturas y PDFs
NODE_ENV=production

# Dashboard (pos.gosenku.com / Next.js)
NEXT_PUBLIC_API_URL=https://api-pos.gosenku.com
NEXT_PUBLIC_TERMINAL_URL=https://terminal.gosenku.com

# Terminal PWA (terminal.gosenku.com)
VITE_API_URL=https://api-pos.gosenku.com
VITE_ENVIRONMENT=production
```

---

*Documento vivo — actualizar conforme el proyecto evoluciona.*
*Versión inicial: Abril 2026 · Decisiones resueltas: Abril 2026*
