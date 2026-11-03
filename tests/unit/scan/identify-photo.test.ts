import { eq } from 'drizzle-orm'
import { productImageEmbeddings, users } from '../../../server/database/schema/index.ts'
import { createProduct } from '../../../server/domain/catalogue/catalogue-service.ts'
import { BoxTextReaderUnavailableError, type BoxTextReader } from '../../../server/domain/scan/box-text-reader.ts'
import { ImageEmbedderUnavailableError, type ImageEmbedder } from '../../../server/domain/scan/image-embedder.ts'
import {
  confirmPhotoIdentification,
  identifyPhoto,
  type PhotoIdentificationDependencies,
} from '../../../server/domain/scan/identify-photo.ts'
import { embeddingDimensions, storeProductEmbedding } from '../../../server/domain/scan/product-image-embeddings.ts'
import { searchProductCandidates } from '../../../server/domain/catalogue/search-product-candidates.ts'
import { emptyProductDraft } from '../../../shared/catalogue/product-draft.ts'
import type { KairosDatabase } from '../../../server/database/open-database.ts'
import { createTestDatabase } from '../../support/create-test-database.ts'

const insertUser = async (database: KairosDatabase): Promise<string> => {
  const [user] = await database.insert(users).values({ email: 'a@example.com', displayName: 'A', passwordHash: 'x' }).returning()
  return user!.id
}

const unitVector = (axis: number): Float32Array => {
  const vector = new Float32Array(embeddingDimensions)
  vector[axis] = 1
  return vector
}

const fakeEmbedder = (embedding: Float32Array): ImageEmbedder => ({ embed: async () => embedding })
const fakeReader = (text: string): BoxTextReader => ({ read: async () => text, close: async () => {} })
const unavailableEmbedder: ImageEmbedder = {
  embed: async () => {
    throw new ImageEmbedderUnavailableError('offline')
  },
}
const unavailableReader: BoxTextReader = {
  read: async () => {
    throw new BoxTextReaderUnavailableError('offline')
  },
  close: async () => {},
}

const buildDependencies = (
  database: KairosDatabase,
  overrides: Partial<PhotoIdentificationDependencies> = {},
): PhotoIdentificationDependencies => ({
  embedder: fakeEmbedder(unitVector(0)),
  textReader: fakeReader(''),
  searchCandidates: query =>
    searchProductCandidates(database, query, { searchTcgdexCards: async () => [], searchEbayListings: async () => [] }),
  ...overrides,
})

describe('identifyPhoto', () => {
  it('auto-picks a product that matches visually and by its full text', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const coffret = await createProduct(database, userId, emptyProductDraft('Coffret Dresseur Elite', 'pokemon-sealed'))
    await createProduct(database, userId, emptyProductDraft('Display Ecarlate', 'pokemon-sealed'))
    await storeProductEmbedding(database, { productId: coffret.id, origin: 'catalogue-image', embedding: unitVector(0) })

    const outcome = await identifyPhoto(
      database,
      Buffer.from('photo-auto'),
      buildDependencies(database, { textReader: fakeReader('Coffret Dresseur Elite') }),
    )

    expect(outcome.autoPicked?.productId).toBe(coffret.id)
    expect(outcome.candidates[0]?.productId).toBe(coffret.id)
    expect(outcome.ocrWords).toContain('coffret')
    expect(outcome.degradedReasons).toEqual([])
  })

  it('proposes text candidates only when no catalogue image exists, without auto-picking', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const coffret = await createProduct(database, userId, emptyProductDraft('Coffret Dresseur Elite', 'pokemon-sealed'))

    const outcome = await identifyPhoto(
      database,
      Buffer.from('photo-text'),
      buildDependencies(database, { textReader: fakeReader('Dresseur') }),
    )

    expect(outcome.candidates.map(candidate => candidate.productId)).toEqual([coffret.id])
    expect(outcome.autoPicked).toBeNull()
  })

  it('returns visual candidates when the OCR is unavailable and says so', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const coffret = await createProduct(database, userId, emptyProductDraft('Coffret Dresseur Elite', 'pokemon-sealed'))
    await storeProductEmbedding(database, { productId: coffret.id, origin: 'catalogue-image', embedding: unitVector(0) })

    const outcome = await identifyPhoto(
      database,
      Buffer.from('photo-no-ocr'),
      buildDependencies(database, { textReader: unavailableReader }),
    )

    expect(outcome.candidates.map(candidate => candidate.productId)).toEqual([coffret.id])
    expect(outcome.autoPicked).toBeNull()
    expect(outcome.degradedReasons).toEqual(['text-reader-unavailable'])
  })

  it('falls back to text candidates when the embedder is unavailable', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const coffret = await createProduct(database, userId, emptyProductDraft('Coffret Dresseur Elite', 'pokemon-sealed'))

    const outcome = await identifyPhoto(
      database,
      Buffer.from('photo-no-embedder'),
      buildDependencies(database, { embedder: unavailableEmbedder, textReader: fakeReader('Dresseur') }),
    )

    expect(outcome.candidates.map(candidate => candidate.productId)).toEqual([coffret.id])
    expect(outcome.degradedReasons).toEqual(['image-embedder-unavailable'])
  })

  it('returns no candidate and both reasons when both models are unavailable', async () => {
    const database = await createTestDatabase()

    const outcome = await identifyPhoto(
      database,
      Buffer.from('photo-nothing'),
      buildDependencies(database, { embedder: unavailableEmbedder, textReader: unavailableReader }),
    )

    expect(outcome.candidates).toEqual([])
    expect(outcome.autoPicked).toBeNull()
    expect(outcome.degradedReasons).toEqual(['image-embedder-unavailable', 'text-reader-unavailable'])
  })

  it('returns at most five candidates', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    for (let index = 0; index < 7; index += 1) {
      await createProduct(database, userId, emptyProductDraft(`Coffret Dresseur ${index}`, 'pokemon-sealed'))
    }

    const outcome = await identifyPhoto(
      database,
      Buffer.from('photo-many'),
      buildDependencies(database, { textReader: fakeReader('Coffret Dresseur') }),
    )

    expect(outcome.candidates).toHaveLength(5)
  })
})

describe('confirmPhotoIdentification', () => {
  it('stores the cached embedding once however many times it is confirmed', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const coffret = await createProduct(database, userId, emptyProductDraft('Coffret Dresseur Elite', 'pokemon-sealed'))
    const { uploadFingerprint } = await identifyPhoto(database, Buffer.from('photo-confirm'), buildDependencies(database))

    await confirmPhotoIdentification(database, { uploadFingerprint, productId: coffret.id })
    await confirmPhotoIdentification(database, { uploadFingerprint, productId: coffret.id })

    const storedRows = await database
      .select()
      .from(productImageEmbeddings)
      .where(eq(productImageEmbeddings.productId, coffret.id))
    expect(storedRows).toHaveLength(1)
    expect(storedRows[0]?.origin).toBe('confirmed-scan')
    expect(storedRows[0]?.uploadFingerprint).toBe(uploadFingerprint)
  })

  it('answers 404 for an unknown fingerprint, an unknown product or an expired cache', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const coffret = await createProduct(database, userId, emptyProductDraft('Coffret Dresseur Elite', 'pokemon-sealed'))
    const startedAt = new Date('2026-11-03T10:00:00Z')
    const { uploadFingerprint } = await identifyPhoto(
      database,
      Buffer.from('photo-expiry'),
      buildDependencies(database, { now: () => startedAt }),
    )

    await expect(
      confirmPhotoIdentification(database, { uploadFingerprint: 'unknown', productId: coffret.id }, startedAt),
    ).rejects.toMatchObject({ statusCode: 404 })
    await expect(
      confirmPhotoIdentification(database, { uploadFingerprint, productId: '00000000-0000-4000-8000-000000000000' }, startedAt),
    ).rejects.toMatchObject({ statusCode: 404 })
    await expect(
      confirmPhotoIdentification(database, { uploadFingerprint, productId: coffret.id }, new Date('2026-11-03T10:16:00Z')),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('keeps at most 200 cached embeddings, evicting the oldest', async () => {
    const database = await createTestDatabase()
    const userId = await insertUser(database)
    const coffret = await createProduct(database, userId, emptyProductDraft('Coffret Dresseur Elite', 'pokemon-sealed'))
    const startedAt = new Date('2026-11-03T12:00:00Z')
    const dependencies = buildDependencies(database, { now: () => startedAt })
    const fingerprints: string[] = []
    for (let index = 0; index < 201; index += 1) {
      fingerprints.push((await identifyPhoto(database, Buffer.from(`bounded-${index}`), dependencies)).uploadFingerprint)
    }

    await expect(
      confirmPhotoIdentification(database, { uploadFingerprint: fingerprints[0]!, productId: coffret.id }, startedAt),
    ).rejects.toMatchObject({ statusCode: 404 })
    await expect(
      confirmPhotoIdentification(database, { uploadFingerprint: fingerprints[200]!, productId: coffret.id }, startedAt),
    ).resolves.toBeUndefined()
  })
})
