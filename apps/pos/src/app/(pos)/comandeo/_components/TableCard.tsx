import type { RestaurantTable, Order, OrderItem } from '@/db/schema'

type OrderWithItems = Order & { items: OrderItem[] }

interface Props {
  table: RestaurantTable
  activeOrder?: OrderWithItems
  onClick: () => void
}

const STATUS_COLORS = {
  available: { bg: '#22C55E', chairs: '#86EFAC', label: 'Libre' },
  occupied:  { bg: '#F59E0B', chairs: '#FCD34D', label: 'Ocupada' },
  urgent:    { bg: '#EF4444', chairs: '#FCA5A5', label: 'Urgente' },
}

function ChairDots({ seats, color }: { seats: number; color: string }) {
  const angles =
    seats <= 2 ? [270, 90] :
    seats <= 4 ? [315, 45, 135, 225] :
    [270, 330, 30, 90, 150, 210]
  return (
    <>
      {angles.slice(0, seats).map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const x = 50 + 38 * Math.cos(rad)
        const y = 50 + 38 * Math.sin(rad)
        return <circle key={i} cx={x} cy={y} r={6} fill={color} />
      })}
    </>
  )
}

export function TableCard({ table, activeOrder, onClick }: Props) {
  const statusKey = table.status as keyof typeof STATUS_COLORS
  const colors = STATUS_COLORS[statusKey] ?? STATUS_COLORS.available
  const itemCount = activeOrder?.items.length ?? 0

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-xl p-2 transition hover:bg-brand-surface/5"
    >
      <svg width={88} height={88} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="32" fill={colors.bg} opacity={0.15} />
        <circle cx="50" cy="50" r="28" fill={colors.bg} />
        <ChairDots seats={Math.min(table.seats, 6)} color={colors.chairs} />
        {itemCount > 0 && (
          <text x="50" y="55" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
            {itemCount}
          </text>
        )}
      </svg>
      <div className="text-center">
        <p className="text-xs font-semibold text-brand-surface">{table.name}</p>
        <p className="text-[10px] text-brand-surface/40">{colors.label}</p>
      </div>
    </button>
  )
}
