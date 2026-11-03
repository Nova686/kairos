import { eq } from 'drizzle-orm'
import { productImageEmbeddings, products, users } from '../../../server/database/schema/index.ts'
import { createProduct, updateProduct } from '../../../server/domain/catalogue/catalogue-service.ts'
import { embedCatalogueImages } from '../../../server/domain/scan/embed-catalogue-images.ts'
import { embeddingDimensions } from '../../../server/domain/scan/product-image-embeddings.ts'
import { ImageEmbedderUnavailableError, type ImageEmbedder } from '../../../server/domain/scan/image-embedder.ts'
import { emptyProductDraft } from '../../../shared/catalogue/product-draft.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const now = new Date('2026-11-03T10:00:00Z')
const oneDayMilliseconds = 24 * 60 * 60 * 1000

const insertUser = async (database: KairosDatabase): Promise<string> => {
  const [user] = await database
    .insert(users)
    .values({ email: 'a@example.com', displayName: 'A', passwordHash: 'x' })
    .returning()
  return user!.id
}

const insertProduct = (database: KairosDatabase, userId: string, name: string, imageUrl: string | null) =>
  createProduct(database, userId, { ...emptyProductDraft(name, 'pokemon-sealed'), imageUrl })

const constantEmbedder = (): ImageEmbedder & { embeddedImages: Buffer[] } => {
  const embeddedImages: Buffer[] = []
  return {
    embeddedImages,
    embed: async (image) => {
      embeddedImages.push(image)
      const embedding = new Float32Array(embeddingDimensions)
      embedding[0] = 1
      return embedding
    },
  }
}

describe('embedCatalogueImages', () => {
  it('embeds the catalogue image of products that have none and records the source URL', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Display', 'https://img.example/a.jpg')
    await insertProduct(database, userId, 'No image', null)
    const embedder = constantEmbedder()

    const summary = await embedCatalogueImages(database, {
      embedder,
      fetchImage: async () => Buffer.from([1]),
      now,
    })

    expect(summary).toEqual({ embeddedCount: 1, failedCount: 0 })
    const storedEmbeddings = await database.select().from(productImageEmbeddings)
    expect(storedEmbeddings).toHaveLength(1)
    expect(storedEmbeddings[0]).toMatchObject({ productId: product.id, origin: 'catalogue-image', imageUrl: 'https://img.example/a.jpg' })
  })

  it('does not embed a product twice', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    await insertProduct(database, userId, 'Display', 'https://img.example/a.jpg')
    const embedder = constantEmbedder()
    const dependencies = { embedder, fetchImage: async () => Buffer.from([1]), now }

    await embedCatalogueImages(database, dependencies)
    await embedCatalogueImages(database, dependencies)

    expect(embedder.embeddedImages).toHaveLength(1)
  })

  it('processes at most 20 products per run', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    for (let index = 0; index < 25; index += 1) {
      await insertProduct(database, userId, `Product ${index}`, `https://img.example/${index}.jpg`)
    }

    const summary = await embedCatalogueImages(database, {
      embedder: constantEmbedder(),
      fetchImage: async () => Buffer.from([1]),
      now,
    })

    expect(summary.embeddedCount).toBe(20)
    expect(await database.select().from(productImageEmbeddings)).toHaveLength(20)
  })

  it('skips a failing URL, records the failure and carries on with the others', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const brokenProduct = await insertProduct(database, userId, 'Broken', 'https://img.example/broken.jpg')
    await insertProduct(database, userId, 'Fine', 'https://img.example/fine.jpg')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const summary = await embedCatalogueImages(database, {
      embedder: constantEmbedder(),
      fetchImage: async (url) => {
        if (url.includes('broken')) {
          throw new Error('HTTP 404')
        }
        return Buffer.from([1])
      },
      now,
    })

    expect(summary).toEqual({ embeddedCount: 1, failedCount: 1 })
    const [failedProduct] = await database.select().from(products).where(eq(products.id, brokenProduct.id))
    expect(failedProduct!.lastEmbeddingFailureAt).toEqual(now)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('records a failure when the embedder rejects the image', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Not an image', 'https://img.example/a.html')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const summary = await embedCatalogueImages(database, {
      embedder: { embed: async () => { throw new Error('unsupported image') } },
      fetchImage: async () => Buffer.from([1]),
      now,
    })

    expect(summary).toEqual({ embeddedCount: 0, failedCount: 1 })
    const [failedProduct] = await database.select().from(products).where(eq(products.id, product.id))
    expect(failedProduct!.lastEmbeddingFailureAt).toEqual(now)
    warn.mockRestore()
  })

  it('retries a failed product only after a day', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Broken', 'https://img.example/a.jpg')
    await database
      .update(products)
      .set({ lastEmbeddingFailureAt: new Date(now.getTime() - oneDayMilliseconds / 2) })
      .where(eq(products.id, product.id))
    const embedder = constantEmbedder()
    const dependencies = { embedder, fetchImage: async () => Buffer.from([1]) }

    const tooSoonSummary = await embedCatalogueImages(database, { ...dependencies, now })
    const nextDaySummary = await embedCatalogueImages(database, {
      ...dependencies,
      now: new Date(now.getTime() + oneDayMilliseconds),
    })

    expect(tooSoonSummary.embeddedCount).toBe(0)
    expect(nextDaySummary.embeddedCount).toBe(1)
    const [recoveredProduct] = await database.select().from(products).where(eq(products.id, product.id))
    expect(recoveredProduct!.lastEmbeddingFailureAt).toBeNull()
  })

  it('aborts the run without marking any product when the model cannot be loaded', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Display', 'https://img.example/a.jpg')
    const modelUnavailable = {
      embed: async () => {
        throw new ImageEmbedderUnavailableError(new Error('offline'))
      },
    }

    await expect(
      embedCatalogueImages(database, { embedder: modelUnavailable, fetchImage: async () => Buffer.from([1]), now }),
    ).rejects.toBeInstanceOf(ImageEmbedderUnavailableError)

    const [untouchedProduct] = await database.select().from(products).where(eq(products.id, product.id))
    expect(untouchedProduct!.lastEmbeddingFailureAt).toBeNull()
  })

  it('does not store an embedding computed for an image that changed during the run', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Display', 'https://img.example/old.jpg')

    const summary = await embedCatalogueImages(database, {
      embedder: constantEmbedder(),
      fetchImage: async () => {
        await updateProduct(database, userId, product.id, { imageUrl: 'https://img.example/new.jpg' })
        return Buffer.from([1])
      },
      now,
    })

    expect(summary).toEqual({ embeddedCount: 0, failedCount: 0 })
    expect(await database.select().from(productImageEmbeddings)).toHaveLength(0)
  })

  it('does not record a failure for an image that changed during the run', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const product = await insertProduct(database, userId, 'Display', 'https://img.example/old.jpg')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await embedCatalogueImages(database, {
      embedder: constantEmbedder(),
      fetchImage: async () => {
        await updateProduct(database, userId, product.id, { imageUrl: 'https://img.example/new.jpg' })
        throw new Error('HTTP 404')
      },
      now,
    })

    const [currentProduct] = await database.select().from(products).where(eq(products.id, product.id))
    expect(currentProduct!.lastEmbeddingFailureAt).toBeNull()
    warn.mockRestore()
  })
})
