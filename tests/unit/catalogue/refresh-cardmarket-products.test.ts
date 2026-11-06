import { cardmarketProducts } from '../../../server/database/schema/index.ts'
import {
  countCardmarketProducts,
  refreshCardmarketProducts,
} from '../../../server/domain/catalogue/refresh-cardmarket-products.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const catalogueResponse = (products: { idProduct: number; name: string }[]) => async (): Promise<Response> =>
  new Response(
    JSON.stringify({
      products: products.map(product => ({ ...product, categoryName: 'Display', idExpansion: 3 })),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )

describe('refreshCardmarketProducts', () => {
  it('inserts the downloaded sealed catalogue', async () => {
    const database = await createTestDatabase()

    await refreshCardmarketProducts(database, catalogueResponse([{ idProduct: 1, name: 'Display A' }, { idProduct: 2, name: 'Display B' }]))

    expect(await countCardmarketProducts(database)).toBe(2)
  })

  it('upserts on a second refresh: renames, adds and never duplicates', async () => {
    const database = await createTestDatabase()
    await refreshCardmarketProducts(database, catalogueResponse([{ idProduct: 1, name: 'Display A' }]))

    await refreshCardmarketProducts(database, catalogueResponse([{ idProduct: 1, name: 'Display A v2' }, { idProduct: 2, name: 'Display B' }]))

    const names = (await database.select().from(cardmarketProducts)).map(product => product.name).sort()
    expect(names).toEqual(['Display A v2', 'Display B'])
  })

  it('keeps the table untouched when the download is empty', async () => {
    const database = await createTestDatabase()
    await refreshCardmarketProducts(database, catalogueResponse([{ idProduct: 1, name: 'Display A' }]))

    await refreshCardmarketProducts(database, catalogueResponse([]))

    expect(await countCardmarketProducts(database)).toBe(1)
  })
})
