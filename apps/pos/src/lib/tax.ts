export const COUNTRY_TAX: Record<string, { rate: number; name: string }> = {
  CR: { rate: 13, name: 'IVA' },
  DO: { rate: 18, name: 'ITBIS' },
}

export function taxRateForCountry(country: string): { rate: number; name: string } {
  return COUNTRY_TAX[country] ?? COUNTRY_TAX['CR']
}

/**
 * Prices are tax-inclusive. Given a total that already contains tax,
 * extract net (pre-tax) and tax components.
 * E.g. total=1130 at 13% → net=1000, tax=130
 */
export function extractTax(inclusiveTotal: number, ratePercent: number): { net: number; tax: number } {
  const net = Math.round(inclusiveTotal / (1 + ratePercent / 100))
  return { net, tax: inclusiveTotal - net }
}
