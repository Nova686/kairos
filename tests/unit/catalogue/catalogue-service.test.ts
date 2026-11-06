import { catalogueChanges, users } from '../../../server/database/schema/index.ts'
import {
  attachBarcode,
  createProduct,
  findProductByBarcode,
  findProductOr404,
  listProductChanges,
  revertCatalogueChange,
  updateProduct,
} from '../../../server/domain/catalogue/catalogue-service.ts'
import { emptyProductDraft } from '../../../shared/catalogue/product-draft.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertUser = async (database: KairosDatabase, email: string): Promise<string> => {
  const [user] = await database.insert(users).values({ email, displayName: email, passwordHash: 'x' }).returning()
  return user!.id
}

describe('catalogue service', () => {
  it('journals a creation with field * and no previous value', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')

    const product = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))

    const changes = await listProductChanges(database, product.id)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ fieldName: '*', previousValue: null, userId })
    expect(product.createdByUserId).toBe(userId)
  })

  it('journals one entry per changed field and none for unchanged values', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const product = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))

    const updatedProduct = await updateProduct(database, userId, product.id, {
      name: 'Display Écarlate',
      language: 'fr',
      category: 'pokemon-sealed',
    })

    expect(updatedProduct).toMatchObject({ name: 'Display Écarlate', language: 'fr' })
    const fieldChanges = (await listProductChanges(database, product.id)).filter(change => change.fieldName !== '*')
    expect(fieldChanges.map(change => change.fieldName).sort()).toEqual(['language', 'name'])
    expect(fieldChanges.find(change => change.fieldName === 'name')).toMatchObject({
      previousValue: 'Display EV1',
      newValue: 'Display Écarlate',
    })
  })

  it('writes no journal entry when nothing changes', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const product = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))

    await updateProduct(database, userId, product.id, { name: 'Display EV1', ebayExcludedKeywords: [] })

    expect(await listProductChanges(database, product.id)).toHaveLength(1)
  })

  it('journals two concurrent edits of one field as a chain of values', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const product = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))

    await Promise.all([
      updateProduct(database, userId, product.id, { name: 'Display EV2' }),
      updateProduct(database, userId, product.id, { name: 'Display EV3' }),
    ])

    const nameChanges = (await listProductChanges(database, product.id)).filter(change => change.fieldName === 'name')
    expect(nameChanges).toHaveLength(2)
    expect(nameChanges[0]!.previousValue).toBe('Display EV1')
    expect(nameChanges[1]!.previousValue).toBe(nameChanges[0]!.newValue)
  })

  it('answers 404 when updating an unknown product', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')

    await expect(updateProduct(database, userId, 'not-a-uuid', { name: 'x' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('reverts a change to the previous value and journals the revert', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const reverterId = await insertUser(database, 'b@example.com')
    const product = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))
    await updateProduct(database, userId, product.id, { name: 'Vandalisé' })
    const nameChange = (await listProductChanges(database, product.id)).find(change => change.fieldName === 'name')!

    const revertedProduct = await revertCatalogueChange(database, reverterId, nameChange.id)

    expect(revertedProduct.name).toBe('Display EV1')
    const revertEntry = (await listProductChanges(database, product.id)).find(change => change.revertedChangeId === nameChange.id)
    expect(revertEntry).toMatchObject({
      fieldName: 'name',
      previousValue: 'Vandalisé',
      newValue: 'Display EV1',
      userId: reverterId,
    })
  })

  it('refuses to revert a creation entry and an already reverted change', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const product = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))
    await updateProduct(database, userId, product.id, { name: 'Autre' })
    const changes = await listProductChanges(database, product.id)
    const creationEntry = changes.find(change => change.fieldName === '*')!
    const nameChange = changes.find(change => change.fieldName === 'name')!

    await expect(revertCatalogueChange(database, userId, creationEntry.id)).rejects.toMatchObject({ statusCode: 409 })
    await revertCatalogueChange(database, userId, nameChange.id)
    await expect(revertCatalogueChange(database, userId, nameChange.id)).rejects.toMatchObject({ statusCode: 409 })
    expect(await database.select().from(catalogueChanges)).toHaveLength(3)
  })

  it('refuses to revert a change whose field was edited again and keeps the later edit', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const product = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))
    await updateProduct(database, userId, product.id, { name: 'Vandalisé' })
    const nameChange = (await listProductChanges(database, product.id)).find(change => change.fieldName === 'name')!
    await updateProduct(database, userId, product.id, { name: 'Display EV1 corrigé' })

    await expect(revertCatalogueChange(database, userId, nameChange.id)).rejects.toMatchObject({ statusCode: 409 })

    expect((await findProductOr404(database, product.id)).name).toBe('Display EV1 corrigé')
  })

  it('reverts a change only once when two reverts of it run at the same time', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const product = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))
    await updateProduct(database, userId, product.id, { name: 'Vandalisé' })
    const nameChange = (await listProductChanges(database, product.id)).find(change => change.fieldName === 'name')!

    const outcomes = await Promise.allSettled([
      revertCatalogueChange(database, userId, nameChange.id),
      revertCatalogueChange(database, userId, nameChange.id),
    ])

    expect(outcomes.map(outcome => outcome.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(outcomes.find(outcome => outcome.status === 'rejected')).toMatchObject({ reason: { statusCode: 409 } })
    expect((await listProductChanges(database, product.id)).filter(change => change.revertedChangeId === nameChange.id)).toHaveLength(1)
  })

  it('answers 404 when reverting an unknown change', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')

    await expect(revertCatalogueChange(database, userId, '00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('links a barcode to a product and finds the product by it', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const product = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))

    await attachBarcode(database, userId, product.id, '3665361000001')

    expect((await findProductByBarcode(database, '3665361000001'))?.id).toBe(product.id)
    expect(await findProductByBarcode(database, '0000000000000')).toBeNull()
  })

  it('answers 409 when the barcode is linked to another product but accepts a repeat on the same product', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const firstProduct = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))
    const secondProduct = await createProduct(database, userId, emptyProductDraft('Display EV2', 'pokemon-sealed'))
    await attachBarcode(database, userId, firstProduct.id, '3665361000001')

    await expect(attachBarcode(database, userId, secondProduct.id, '3665361000001')).rejects.toMatchObject({
      statusCode: 409,
    })
    await expect(attachBarcode(database, userId, firstProduct.id, '3665361000001')).resolves.toBeUndefined()
  })

  it('links a barcode once when the same product attaches it twice at the same time', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const product = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))

    await Promise.all([
      attachBarcode(database, userId, product.id, '3665361000001'),
      attachBarcode(database, userId, product.id, '3665361000001'),
    ])

    expect((await listProductChanges(database, product.id)).filter(change => change.subject === 'barcode')).toHaveLength(1)
  })

  it('answers 409 to the second of two products attaching the same barcode at the same time', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database, 'a@example.com')
    const firstProduct = await createProduct(database, userId, emptyProductDraft('Display EV1', 'pokemon-sealed'))
    const secondProduct = await createProduct(database, userId, emptyProductDraft('Display EV2', 'pokemon-sealed'))

    const outcomes = await Promise.allSettled([
      attachBarcode(database, userId, firstProduct.id, '3665361000001'),
      attachBarcode(database, userId, secondProduct.id, '3665361000001'),
    ])

    expect(outcomes.map(outcome => outcome.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(outcomes.find(outcome => outcome.status === 'rejected')).toMatchObject({ reason: { statusCode: 409 } })
  })
})
