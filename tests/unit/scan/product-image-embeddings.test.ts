import { eq } from 'drizzle-orm'
import { productImageEmbeddings, products, users } from '../../../server/database/schema/index.ts'
import { createProduct, listProductChanges, revertCatalogueChange, updateProduct } from '../../../server/domain/catalogue/catalogue-service.ts'
import {
  embeddingDimensions,
  findSimilarProducts,
  storeProductEmbedding,
} from '../../../server/domain/scan/product-image-embeddings.ts'
import { emptyProductDraft } from '../../../shared/catalogue/product-draft.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const unitVector = (axisIndex: number, secondAxisIndex?: number): Float32Array => {
  const vector = new Float32Array(embeddingDimensions)
  if (secondAxisIndex === undefined) {
    vector[axisIndex] = 1
    return vector
  }
  vector[axisIndex] = Math.SQRT1_2
  vector[secondAxisIndex] = Math.SQRT1_2
  return vector
}

const insertUser = async (database: KairosDatabase): Promise<string> => {
  const [user] = await database
    .insert(users)
    .values({ email: 'a@example.com', displayName: 'A', passwordHash: 'x' })
    .returning()
  return user!.id
}

const insertProduct = (database: KairosDatabase, userId: string, name: string, imageUrl: string | null = null) =>
  createProduct(database, userId, { ...emptyProductDraft(name, 'pokemon-sealed'), imageUrl })

describe('findSimilarProducts', () => {
  it('returns the nearest product first with a similarity of 1 for an identical vector', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const displayCase = await insertProduct(database, userId, 'Display')
    const coffret = await insertProduct(database, userId, 'Coffret')
    await storeProductEmbedding(database, { productId: displayCase.id, origin: 'catalogue-image', embedding: unitVector(0) })
    await storeProductEmbedding(database, { productId: coffret.id, origin: 'catalogue-image', embedding: unitVector(1) })

    const similarProducts = await findSimilarProducts(database, unitVector(1))

    expect(similarProducts.map(similarProduct => similarProduct.productId)).toEqual([coffret.id, displayCase.id])
    expect(similarProducts[0]!.similarity).toBeCloseTo(1, 5)
    expect(similarProducts[1]!.similarity).toBeCloseTo(0, 5)
  })

  it('keeps the best embedding per product and honours the limit', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const first = await insertProduct(database, userId, 'First')
    const second = await insertProduct(database, userId, 'Second')
    await storeProductEmbedding(database, { productId: first.id, origin: 'catalogue-image', embedding: unitVector(0) })
    await storeProductEmbedding(database, {
      productId: first.id,
      origin: 'confirmed-scan',
      uploadFingerprint: 'a',
      embedding: unitVector(1, 2),
    })
    await storeProductEmbedding(database, { productId: second.id, origin: 'catalogue-image', embedding: unitVector(5) })

    const allSimilarProducts = await findSimilarProducts(database, unitVector(1))
    const limitedSimilarProducts = await findSimilarProducts(database, unitVector(1), 1)

    expect(allSimilarProducts.map(similarProduct => similarProduct.productId)).toEqual([first.id, second.id])
    expect(allSimilarProducts[0]!.similarity).toBeCloseTo(Math.SQRT1_2, 5)
    expect(limitedSimilarProducts).toHaveLength(1)
  })

  it('returns nothing when no embedding is stored', async () => {
    const database = await createTestDatabase()

    expect(await findSimilarProducts(database, unitVector(0))).toEqual([])
  })

  it('sees an embedding stored after a previous search', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const first = await insertProduct(database, userId, 'First')
    const second = await insertProduct(database, userId, 'Second')
    await storeProductEmbedding(database, { productId: first.id, origin: 'catalogue-image', embedding: unitVector(0) })
    await findSimilarProducts(database, unitVector(1))

    await storeProductEmbedding(database, { productId: second.id, origin: 'catalogue-image', embedding: unitVector(1) })
    const similarProducts = await findSimilarProducts(database, unitVector(1))

    expect(similarProducts[0]!.productId).toBe(second.id)
  })

  it('rejects a query vector of the wrong length', async () => {
    const database = await createTestDatabase()

    await expect(findSimilarProducts(database, new Float32Array(3))).rejects.toThrow(/512/)
  })
})

describe('storeProductEmbedding', () => {
  it('is a no-op when the same upload fingerprint is stored twice', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Display')
    const storedEmbedding = {
      productId: product.id,
      origin: 'confirmed-scan' as const,
      uploadFingerprint: 'abc123',
      embedding: unitVector(0),
    }

    await storeProductEmbedding(database, storedEmbedding)
    await storeProductEmbedding(database, storedEmbedding)

    expect(await database.select().from(productImageEmbeddings)).toHaveLength(1)
  })

  it('rejects an embedding of the wrong length', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Display')

    await expect(
      storeProductEmbedding(database, { productId: product.id, origin: 'catalogue-image', embedding: new Float32Array(3) }),
    ).rejects.toThrow(/512/)
  })
})

describe('catalogue image change', () => {
  it('replaces the catalogue-image embeddings of a product whose imageUrl changes and keeps confirmed scans', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Display', 'https://img.example/a.jpg')
    const otherProduct = await insertProduct(database, userId, 'Other', 'https://img.example/o.jpg')
    await storeProductEmbedding(database, { productId: product.id, origin: 'catalogue-image', imageUrl: 'https://img.example/a.jpg', embedding: unitVector(0) })
    await storeProductEmbedding(database, { productId: product.id, origin: 'confirmed-scan', uploadFingerprint: 'f', embedding: unitVector(1) })
    await storeProductEmbedding(database, { productId: otherProduct.id, origin: 'catalogue-image', embedding: unitVector(2) })
    await findSimilarProducts(database, unitVector(0))

    await updateProduct(database, userId, product.id, { imageUrl: 'https://img.example/b.jpg' })

    const remainingEmbeddings = await database
      .select({ productId: productImageEmbeddings.productId, origin: productImageEmbeddings.origin })
      .from(productImageEmbeddings)
    expect(remainingEmbeddings).toHaveLength(2)
    expect(remainingEmbeddings).toContainEqual({ productId: product.id, origin: 'confirmed-scan' })
    expect(remainingEmbeddings).toContainEqual({ productId: otherProduct.id, origin: 'catalogue-image' })
    const similarProducts = await findSimilarProducts(database, unitVector(0))
    expect(similarProducts.some(similarProduct => similarProduct.productId === product.id && similarProduct.similarity > 0.5)).toBe(false)
  })

  it('keeps the embeddings when another field changes', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Display', 'https://img.example/a.jpg')
    await storeProductEmbedding(database, { productId: product.id, origin: 'catalogue-image', embedding: unitVector(0) })

    await updateProduct(database, userId, product.id, { name: 'Display renamed' })

    expect(await database.select().from(productImageEmbeddings).where(eq(productImageEmbeddings.productId, product.id))).toHaveLength(1)
  })

  it('clears the embedding failure marker when the imageUrl changes', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Display', 'https://img.example/a.jpg')
    await database.update(products).set({ lastEmbeddingFailureAt: new Date('2026-11-01T10:00:00Z') })

    const updatedProduct = await updateProduct(database, userId, product.id, { imageUrl: 'https://img.example/b.jpg' })

    expect(updatedProduct.lastEmbeddingFailureAt).toBeNull()
  })

  it('replaces the catalogue-image embeddings when an imageUrl change is reverted', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Display', 'https://img.example/a.jpg')
    await updateProduct(database, userId, product.id, { imageUrl: 'https://img.example/b.jpg' })
    await storeProductEmbedding(database, { productId: product.id, origin: 'catalogue-image', embedding: unitVector(0) })
    const imageChange = (await listProductChanges(database, product.id)).find(change => change.fieldName === 'imageUrl')!

    await revertCatalogueChange(database, userId, imageChange.id)

    expect(await database.select().from(productImageEmbeddings)).toHaveLength(0)
  })
})
