import { countCardmarketProducts } from '../domain/catalogue/refresh-cardmarket-products'

export default defineNitroPlugin(() => {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return
  }
  void (async () => {
    if ((await countCardmarketProducts(await useDatabase())) === 0) {
      await runTask('catalogue:refresh-cardmarket-products')
    }
  })().catch((failure: unknown) => {
    console.error('Initial Cardmarket catalogue refresh failed', failure)
  })
})
