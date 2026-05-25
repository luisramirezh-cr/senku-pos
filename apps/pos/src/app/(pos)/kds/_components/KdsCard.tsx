import type { Order, OrderItem } from '@/db/schema'

type OrderWithItems = Order & { items: OrderItem[] }

const CHANNEL_ICON: Record<string, string> = { DINE_IN: '🍽', TAKEOUT: '🥡', DELIVERY: '🛵' }
const STATUS_COLOR: Record<string, string> = {
  sent_to_kitchen: '#F59E0B',
  preparing:       '#3B82F6',
  ready:           '#22C55E',
}

function getElapsedMinutes(openedAt: Date | string): number {
  return Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000)
}

function TimerBadge({ openedAt }: { openedAt: Date | string }) {
  const mins = getElapsedMinutes(openedAt)
  const color = mins < 8 ? '#22C55E' : mins < 15 ? '#F59E0B' : '#EF4444'
  return (
    <span style={{ color, fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
      {mins}min
    </span>
  )
}

interface Props {
  order: OrderWithItems
  onStatusChange: (orderId: string, status: string) => void
}

export function KdsCard({ order, onStatusChange }: Props) {
  const borderColor = STATUS_COLOR[order.status] ?? '#F59E0B'
  const isOverdue = getElapsedMinutes(order.openedAt) > 15

  return (
    <div
      className={`rounded-xl bg-white p-4 shadow-sm ${isOverdue ? 'ring-2 ring-red-400' : ''}`}
      style={{ borderTop: `4px solid ${borderColor}` }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{CHANNEL_ICON[order.channel] ?? '📋'}</span>
          <span className="text-sm font-bold text-gray-900">
            {order.identifier ?? order.channel}
          </span>
        </div>
        <TimerBadge openedAt={order.openedAt} />
      </div>

      <div className="mb-3 space-y-1.5">
        {order.items.map((item) => (
          <div key={item.id}>
            <span className="text-sm font-semibold text-gray-800">
              {item.quantity}× {item.name}
            </span>
            {item.notes && (
              <p className="text-xs italic text-gray-400">{item.notes}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {order.status === 'sent_to_kitchen' && (
          <button
            onClick={() => onStatusChange(order.id, 'preparing')}
            className="flex-1 rounded-lg bg-blue-100 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-200"
          >
            En preparación
          </button>
        )}
        {(order.status === 'sent_to_kitchen' || order.status === 'preparing') && (
          <button
            onClick={() => onStatusChange(order.id, 'ready')}
            className="flex-1 rounded-lg bg-green-100 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-200"
          >
            Listo ✓
          </button>
        )}
        {order.status === 'ready' && (
          <span className="flex-1 rounded-lg bg-green-50 py-1.5 text-center text-xs font-semibold text-green-600">
            ✓ Listo para entregar
          </span>
        )}
      </div>
    </div>
  )
}
