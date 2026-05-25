const CRC = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatCRC(amount: number | string): string {
  return CRC.format(Number(amount))
}
