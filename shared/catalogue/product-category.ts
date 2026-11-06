export type ProductCategory = 'pokemon-sealed' | 'graded-card' | 'toy' | 'makeup' | 'other'

export const productCategories: ProductCategory[] = ['pokemon-sealed', 'graded-card', 'toy', 'makeup', 'other']

export const productCategoryLabels: Record<ProductCategory, string> = {
  'pokemon-sealed': 'Pokémon scellé',
  'graded-card': 'Carte gradée',
  'toy': 'Jouet',
  'makeup': 'Maquillage',
  'other': 'Autre',
}

export const isProductCategory = (category: string): category is ProductCategory =>
  (productCategories as string[]).includes(category)
