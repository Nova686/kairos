import { and, eq } from 'drizzle-orm'
import type { KairosDatabase } from '../../database/open-database.ts'
import { productImageEmbeddings } from '../../database/schema/index.ts'

export const embeddingDimensions = 512

export type EmbeddingOrigin = 'catalogue-image' | 'confirmed-scan'

export type StoredProductEmbedding = {
  productId: string
  origin: EmbeddingOrigin
  imageUrl?: string | null
  uploadFingerprint?: string | null
  embedding: Float32Array
}

export type SimilarProduct = { productId: string, similarity: number }

type LoadedEmbeddingMatrix = {
  version: number
  productIds: string[]
  vectors: Float32Array[]
}

let embeddingsVersion = 0
const loadedMatrices = new WeakMap<KairosDatabase, LoadedEmbeddingMatrix>()

export const invalidateEmbeddingMatrix = (): void => {
  embeddingsVersion += 1
}

const assertEmbeddingLength = (embedding: ArrayLike<number>): void => {
  if (embedding.length !== embeddingDimensions) {
    throw new Error(`An image embedding must have ${embeddingDimensions} dimensions, got ${embedding.length}`)
  }
}

export const storeProductEmbedding = async (
  database: KairosDatabase,
  storedEmbedding: StoredProductEmbedding,
): Promise<void> => {
  assertEmbeddingLength(storedEmbedding.embedding)
  await database
    .insert(productImageEmbeddings)
    .values({
      productId: storedEmbedding.productId,
      origin: storedEmbedding.origin,
      imageUrl: storedEmbedding.imageUrl ?? null,
      uploadFingerprint: storedEmbedding.uploadFingerprint ?? null,
      embedding: Array.from(storedEmbedding.embedding),
    })
    .onConflictDoNothing({ target: productImageEmbeddings.uploadFingerprint })
  invalidateEmbeddingMatrix()
}

export const deleteCatalogueImageEmbeddings = async (
  database: Pick<KairosDatabase, 'delete'>,
  productId: string,
): Promise<void> => {
  await database
    .delete(productImageEmbeddings)
    .where(and(eq(productImageEmbeddings.productId, productId), eq(productImageEmbeddings.origin, 'catalogue-image')))
  invalidateEmbeddingMatrix()
}

const loadEmbeddingMatrix = async (database: KairosDatabase): Promise<LoadedEmbeddingMatrix> => {
  const cachedMatrix = loadedMatrices.get(database)
  if (cachedMatrix?.version === embeddingsVersion) {
    return cachedMatrix
  }
  const versionBeforeLoading = embeddingsVersion
  const storedRows = await database
    .select({ productId: productImageEmbeddings.productId, embedding: productImageEmbeddings.embedding })
    .from(productImageEmbeddings)
  const loadedMatrix: LoadedEmbeddingMatrix = {
    version: versionBeforeLoading,
    productIds: storedRows.map(storedRow => storedRow.productId),
    vectors: storedRows.map(storedRow => Float32Array.from(storedRow.embedding)),
  }
  loadedMatrices.set(database, loadedMatrix)
  return loadedMatrix
}

const dotProduct = (firstVector: Float32Array, secondVector: Float32Array): number => {
  let sum = 0
  for (let dimension = 0; dimension < firstVector.length; dimension += 1) {
    sum += firstVector[dimension]! * secondVector[dimension]!
  }
  return sum
}

export const findSimilarProducts = async (
  database: KairosDatabase,
  embedding: Float32Array,
  limit = 10,
): Promise<SimilarProduct[]> => {
  assertEmbeddingLength(embedding)
  const embeddingMatrix = await loadEmbeddingMatrix(database)
  const bestSimilarityByProduct = new Map<string, number>()
  embeddingMatrix.vectors.forEach((storedVector, rowIndex) => {
    const productId = embeddingMatrix.productIds[rowIndex]!
    const similarity = dotProduct(storedVector, embedding)
    if (similarity > (bestSimilarityByProduct.get(productId) ?? -Infinity)) {
      bestSimilarityByProduct.set(productId, similarity)
    }
  })
  return [...bestSimilarityByProduct]
    .map(([productId, similarity]) => ({ productId, similarity }))
    .sort((first, second) => second.similarity - first.similarity)
    .slice(0, limit)
}
