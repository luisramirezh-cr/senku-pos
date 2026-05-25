import { db } from './index'
import { products } from './schema'

const BUSINESS_ID = process.env.DEV_MOCK_BUSINESS_ID ?? 'dev-business-001'

const SEED_PRODUCTS = [
  // Bebidas
  { name: 'Café Americano', category: 'Bebidas', price: '1200', sku: 'BEB-001' },
  { name: 'Café con Leche', category: 'Bebidas', price: '1500', sku: 'BEB-002' },
  { name: 'Cappuccino', category: 'Bebidas', price: '1800', sku: 'BEB-003' },
  { name: 'Refresco Natural', category: 'Bebidas', price: '1000', sku: 'BEB-004' },
  { name: 'Agua Botella', category: 'Bebidas', price: '700', sku: 'BEB-005' },
  { name: 'Jugos Naturales', category: 'Bebidas', price: '1400', sku: 'BEB-006' },
  // Desayunos
  { name: 'Gallo Pinto', category: 'Desayunos', price: '2500', sku: 'DES-001' },
  { name: 'Casado de Pollo', category: 'Almuerzo', price: '4500', sku: 'ALM-001' },
  { name: 'Casado de Carne', category: 'Almuerzo', price: '5000', sku: 'ALM-002' },
  { name: 'Casado de Pescado', category: 'Almuerzo', price: '4800', sku: 'ALM-003' },
  { name: 'Arroz con Pollo', category: 'Almuerzo', price: '4200', sku: 'ALM-004' },
  { name: 'Sopa del Día', category: 'Almuerzo', price: '2800', sku: 'ALM-005' },
  // Snacks
  { name: 'Empanada', category: 'Snacks', price: '800', sku: 'SNA-001' },
  { name: 'Patacones', category: 'Snacks', price: '1200', sku: 'SNA-002' },
  { name: 'Yuca Frita', category: 'Snacks', price: '1500', sku: 'SNA-003' },
  // Postres
  { name: 'Tres Leches', category: 'Postres', price: '1500', sku: 'POS-001' },
  { name: 'Arroz con Leche', category: 'Postres', price: '1200', sku: 'POS-002' },
  { name: 'Flan de Coco', category: 'Postres', price: '1300', sku: 'POS-003' },
]

console.log(`Seeding businessId: ${BUSINESS_ID}`)

await db.delete(products)

await db.insert(products).values(
  SEED_PRODUCTS.map((p) => ({
    businessId: BUSINESS_ID,
    name: p.name,
    category: p.category,
    price: p.price,
    sku: p.sku,
    isActive: true,
  })),
)

console.log(`✓ ${SEED_PRODUCTS.length} productos insertados.`)
process.exit(0)
