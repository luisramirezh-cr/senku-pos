import { extractTax } from '@/lib/tax'
import type { SaleResultData } from './SaleResult'

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  sinpe: 'SINPE',
}

interface Props {
  result: SaleResultData
  businessName: string
}

export function Receipt({ result, businessName }: Props) {
  const {
    saleId, items, total, discount, change,
    paymentMethod, taxRate, taxName,
    customer, pointsEarned, pointsRedeemed,
  } = result

  const { net, tax } = extractTax(total, taxRate)
  const now = new Date()
  const dateStr = now.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="receipt-print-target p-4 text-[11px] leading-snug">
      <div className="mb-3 text-center">
        <p className="text-base font-bold">{businessName}</p>
        <p className="text-[10px] text-gray-500">Senku POS</p>
        <p className="mt-1 text-[10px]">{dateStr} {timeStr}</p>
        <p className="font-mono text-[10px] text-gray-500">#{saleId.slice(0, 8).toUpperCase()}</p>
      </div>

      <hr className="my-2 border-dashed border-gray-400" />

      <table className="w-full">
        <tbody>
          {items.map((item) => (
            <tr key={item.product.id}>
              <td className="py-0.5 pr-2 align-top">{item.quantity}x</td>
              <td className="py-0.5 align-top">{item.product.name}</td>
              <td className="py-0.5 text-right align-top font-mono">
                {(parseFloat(item.product.price) * item.quantity).toLocaleString('es-CR', {
                  style: 'currency',
                  currency: 'CRC',
                  minimumFractionDigits: 0,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="my-2 border-dashed border-gray-400" />

      <div className="space-y-0.5">
        {discount > 0 && (
          <div className="flex justify-between">
            <span>Descuento</span>
            <span className="font-mono">
              -{discount.toLocaleString('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0 })}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Neto</span>
          <span className="font-mono">
            {net.toLocaleString('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{taxName}</span>
          <span className="font-mono">
            {tax.toLocaleString('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex justify-between font-bold">
          <span>TOTAL</span>
          <span className="font-mono">
            {total.toLocaleString('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0 })}
          </span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Pago: {METHOD_LABEL[paymentMethod] ?? paymentMethod}</span>
          {paymentMethod === 'cash' && change > 0 && (
            <span className="font-mono">
              Cambio: {change.toLocaleString('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0 })}
            </span>
          )}
        </div>
      </div>

      {customer && (
        <>
          <hr className="my-2 border-dashed border-gray-400" />
          <div className="text-center">
            <p className="font-semibold">{customer.name}</p>
            {pointsRedeemed > 0 && <p>Puntos canjeados: -{pointsRedeemed}</p>}
            <p>Puntos ganados: +{pointsEarned}</p>
          </div>
        </>
      )}

      <hr className="my-2 border-dashed border-gray-400" />
      <p className="text-center text-[10px] text-gray-400">¡Gracias por su compra!</p>
    </div>
  )
}
