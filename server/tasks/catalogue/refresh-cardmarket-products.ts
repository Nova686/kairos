import { refreshCardmarketProducts } from '../../domain/catalogue/refresh-cardmarket-products'

export default defineTask({
  meta: {
    name: 'catalogue:refresh-cardmarket-products',
    description: 'Refresh the local Cardmarket sealed product catalogue',
  },
  async run() {
    return { result: { refreshedProducts: await refreshCardmarketProducts(await useDatabase()) } }
  },
})
