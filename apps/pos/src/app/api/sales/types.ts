export interface SaleItemInput {
  productId: string
  name?:     string   // product name, used for fiscal line description
  quantity:  number
  unitPrice: number
}
