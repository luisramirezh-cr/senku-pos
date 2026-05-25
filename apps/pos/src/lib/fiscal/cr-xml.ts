import { create } from 'xmlbuilder2'

export interface CrLine {
  lineNumber: number
  description: string
  quantity: number
  unitPrice: number   // price inclusive of IVA
  taxRate: number     // e.g. 13
}

export interface CrInvoiceInput {
  accessKey: string      // 50-digit clave de acceso
  consecutive: string    // full 20-char número consecutivo (tipo + establecimiento + terminal + consecutivo)
  issuerRnc: string      // cédula jurídica/física sin guiones
  issuerName: string
  issuedAt: Date
  lines: CrLine[]
  taxName: string        // 'IVA'
  activityCode?: string  // código de actividad CIIU; default 562001 (restaurantes)
}

function randomSecurityCode(): string {
  return String(Math.floor(10000000 + Math.random() * 89999999))
}

/**
 * Builds the 50-digit clave de acceso for CR Hacienda (FE v4.4 XSD: pattern [0-9]{50}).
 * Format: pais(3) + ddmmyy(6) + cedula(12) + tipoDoc(2) + estab(3) + terminal(5) + consec(10) + situacion(1) + seguridad(8) = 50
 * 2-digit year (yy) is required to hit exactly 50 digits per the Hacienda XSD constraint.
 */
export function buildCrAccessKey(opts: {
  issuedAt: Date
  rnc: string
  docType?: string
  establishment: string
  terminal: string
  consecutive: string
}): string {
  const d = opts.issuedAt
  const dd  = String(d.getDate()).padStart(2, '0')
  const mm  = String(d.getMonth() + 1).padStart(2, '0')
  const yy  = String(d.getFullYear()).slice(-2)
  const rnc     = opts.rnc.replace(/-/g, '').padStart(12, '0')
  const docType = (opts.docType ?? '01').padStart(2, '0')
  const secCode = randomSecurityCode()
  return `506${dd}${mm}${yy}${rnc}${docType}${opts.establishment}${opts.terminal}${opts.consecutive}1${secCode}`
}

/** Full 20-char número consecutivo: tipoComprobante(2) + estab(3) + terminal(5) + consecutivo(10) */
export function buildCrConsecutivo(opts: {
  docType: string        // '01'=FE, '04'=TE
  establishment: string  // 3-digit
  terminal: string       // 5-digit
  consecutive: string    // 10-digit
}): string {
  return `${opts.docType}${opts.establishment}${opts.terminal}${opts.consecutive}`
}

export function generateCrXml(input: CrInvoiceInput): string {
  const totalBruto = input.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const taxTotal   = input.lines.reduce((s, l) => {
    const net = (l.unitPrice * l.quantity) / (1 + l.taxRate / 100)
    return s + (l.unitPrice * l.quantity - net)
  }, 0)

  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('FacturaElectronica', {
      xmlns: 'https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    })
      .ele('Clave').txt(input.accessKey).up()
      .ele('CodigoActividad').txt(input.activityCode ?? '562001').up()
      .ele('NumeroConsecutivo').txt(input.consecutive).up()
      .ele('FechaEmision').txt(input.issuedAt.toISOString().replace('Z', '-06:00')).up()
      .ele('Emisor')
        .ele('Nombre').txt(input.issuerName).up()
        .ele('Identificacion')
          .ele('Tipo').txt('02').up()   // 02 = cédula jurídica
          .ele('Numero').txt(input.issuerRnc.replace(/-/g, '')).up()
        .up()
      .up()
      .ele('CondicionVenta').txt('01').up()   // 01 = contado
      .ele('MedioPago').txt('01').up()        // 01 = efectivo (override per sale as needed)
      .ele('DetalleServicio')

  input.lines.forEach((line) => {
    const total   = line.unitPrice * line.quantity
    const net     = total / (1 + line.taxRate / 100)
    const taxAmt  = total - net

    root
      .ele('LineaDetalle')
        .ele('NumeroLinea').txt(String(line.lineNumber)).up()
        .ele('Cantidad').txt(String(line.quantity)).up()
        .ele('UnidadMedida').txt('Unid').up()
        .ele('Detalle').txt(line.description.slice(0, 200)).up()
        .ele('PrecioUnitario').txt(line.unitPrice.toFixed(5)).up()
        .ele('MontoTotal').txt(total.toFixed(2)).up()
        .ele('SubTotal').txt(total.toFixed(2)).up()
        .ele('Impuesto')
          .ele('Codigo').txt('01').up()        // 01 = IVA
          .ele('CodigoTarifa').txt('08').up()  // 08 = 13%
          .ele('Tarifa').txt(String(line.taxRate)).up()
          .ele('Monto').txt(taxAmt.toFixed(2)).up()
        .up()
        .ele('ImpuestoNeto').txt(taxAmt.toFixed(2)).up()
        .ele('MontoTotalLinea').txt(total.toFixed(2)).up()
      .up()
  })

  root.up()
    .ele('ResumenFactura')
      .ele('CodigoTipoMoneda')
        .ele('CodigoMoneda').txt('CRC').up()
        .ele('TipoCambio').txt('1').up()
      .up()
      .ele('TotalServGravados').txt(totalBruto.toFixed(2)).up()
      .ele('TotalServExentos').txt('0.00').up()
      .ele('TotalServExonerado').txt('0.00').up()
      .ele('TotalMercanciasGravadas').txt('0.00').up()
      .ele('TotalMercanciasExentas').txt('0.00').up()
      .ele('TotalMercExonerada').txt('0.00').up()
      .ele('TotalGravado').txt(totalBruto.toFixed(2)).up()
      .ele('TotalExento').txt('0.00').up()
      .ele('TotalExonerado').txt('0.00').up()
      .ele('TotalVenta').txt(totalBruto.toFixed(2)).up()
      .ele('TotalDescuentos').txt('0.00').up()
      .ele('TotalVentaNeta').txt(totalBruto.toFixed(2)).up()
      .ele('TotalImpuesto').txt(taxTotal.toFixed(2)).up()
      .ele('TotalComprobante').txt(totalBruto.toFixed(2)).up()
    .up()

  return root.end({ prettyPrint: true })
}
