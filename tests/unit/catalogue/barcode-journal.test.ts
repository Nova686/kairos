import { users } from '../../../server/database/schema/index.ts'
import {
  attachBarcode,
  createProduct,
  detachBarcode,
  findProductByBarcode,
  listProductChanges,
  revertCatalogueChange,
} from '../../../server/domain/catalogue/catalogue-service.ts'
import { emptyProductDraft } from '../../../shared/catalogue/product-draft.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const barcode = '3665361000001'

const setUp = async (): Promise<{ database: KairosDatabase, userId: string, productId: string, otherProductId: string }> => {
  const database = await createTestDatabase()
  const [user] = await database
    .insert(users)
    .values({ email: 'a@example.com', displayName: 'A', passwordHash: 'x' })
    .returning()
  const product = await createProduct(database, user!.id, emptyProductDraft('Un', 'other'))
  const otherProduct = await createProduct(database, user!.id, emptyProductDraft('Deux', 'other'))
  return { database, userId: user!.id, productId: product.id, otherProductId: otherProduct.id }
}

const barcodeChanges = async (database: KairosDatabase, productId: string) =>
  (await listProductChanges(database, productId)).filter(change => change.subject === 'barcode')

describe('barcode journal', () => {
  it('journals a link once and writes nothing when the link already exists', async () => {
    const { database, userId, productId } = await setUp()

    await attachBarcode(database, userId, productId, barcode)
    await attachBarcode(database, userId, productId, barcode)

    const changes = await barcodeChanges(database, productId)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ fieldName: 'barcode', previousValue: null, newValue: Number(barcode), userId })
  })

  it('detaches a barcode with a journal entry and 404s when it is not linked to that product', async () => {
    const { database, userId, productId, otherProductId } = await setUp()
    await attachBarcode(database, userId, productId, barcode)

    await expect(detachBarcode(database, userId, otherProductId, barcode)).rejects.toMatchObject({ statusCode: 404 })
    await detachBarcode(database, userId, productId, barcode)

    expect(await findProductByBarcode(database, barcode)).toBeNull()
    const changes = await barcodeChanges(database, productId)
    expect(changes[1]).toMatchObject({ previousValue: Number(barcode), newValue: null })
    await expect(detachBarcode(database, userId, productId, barcode)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('reverts a link by detaching and a detach by re-attaching', async () => {
    const { database, userId, productId } = await setUp()
    await attachBarcode(database, userId, productId, barcode)
    const [linkChange] = await barcodeChanges(database, productId)

    await revertCatalogueChange(database, userId, linkChange!.id)
    expect(await findProductByBarcode(database, barcode)).toBeNull()

    const detachChange = (await barcodeChanges(database, productId))[1]
    expect(detachChange).toMatchObject({ revertedChangeId: linkChange!.id })
    await revertCatalogueChange(database, userId, detachChange!.id)
    expect((await findProductByBarcode(database, barcode))?.id).toBe(productId)
  })

  it('refuses to revert twice, to revert a detach when linked elsewhere, and to revert a link no longer in place', async () => {
    const { database, userId, productId, otherProductId } = await setUp()
    await attachBarcode(database, userId, productId, barcode)
    const [linkChange] = await barcodeChanges(database, productId)
    await detachBarcode(database, userId, productId, barcode)
    const [, detachChange] = await barcodeChanges(database, productId)
    await attachBarcode(database, userId, otherProductId, barcode)

    await expect(revertCatalogueChange(database, userId, detachChange!.id)).rejects.toMatchObject({ statusCode: 409 })
    await expect(revertCatalogueChange(database, userId, linkChange!.id)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('refuses a second revert of the same barcode change', async () => {
    const { database, userId, productId } = await setUp()
    await attachBarcode(database, userId, productId, barcode)
    const [linkChange] = await barcodeChanges(database, productId)
    await revertCatalogueChange(database, userId, linkChange!.id)

    await expect(revertCatalogueChange(database, userId, linkChange!.id)).rejects.toMatchObject({ statusCode: 409 })
  })
})
