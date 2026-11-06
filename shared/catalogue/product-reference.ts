import type { ProductCategory } from './product-category.ts'

export interface ProductReference {
  id: string
  name: string
  category: ProductCategory
}
