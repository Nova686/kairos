import { createHash } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { createError } from 'h3'
import type { KairosDatabase } from '../../database/open-database.ts'
import { products } from '../../database/schema/index.ts'
import {
  toCatalogueCandidate,
  type ProductCandidate,
  type ProductSearchOutcome,
} from '../catalogue/search-product-candidates.ts'
import { BoxTextReaderUnavailableError, type BoxTextReader } from './box-text-reader.ts'
import { ImageEmbedderUnavailableError, type ImageEmbedder } from './image-embedder.ts'
import { cachePhotoEmbedding, findCachedPhotoEmbedding } from './photo-embedding-cache.ts'
import { findSimilarProducts, storeProductEmbedding } from './product-image-embeddings.ts'
import { extractSearchWords } from '../../../shared/scan/extract-search-words.ts'
import {
  scorePhotoCandidates,
  shouldAutoPick,
  type PhotoCandidateSignal,
} from '../../../shared/scan/score-photo-candidates.ts'

export type PhotoDegradedReason = 'image-embedder-unavailable' | 'text-reader-unavailable'

export type PhotoIdentificationDependencies = {
  embedder: ImageEmbedder
  textReader: BoxTextReader
  searchCandidates: (query: string) => Promise<ProductSearchOutcome>
  now?: () => Date
}

export type PhotoIdentification = {
  autoPicked: ProductCandidate | null
  candidates: ProductCandidate[]
  uploadFingerprint: string
  ocrWords: string[]
  degradedReasons: PhotoDegradedReason[]
  unavailableSources: string[]
}

const maximumReturnedCandidates = 5
const maximumVisualCandidates = 10
const minimumVisualSimilarity = 0.5

const outcomeOrNullWhenUnavailable = async <Outcome>(
  attempt: () => Promise<Outcome>,
  isUnavailableFailure: (failure: unknown) => boolean,
): Promise<Outcome | null> => {
  try {
    return await attempt()
  }
  catch (failure) {
    if (isUnavailableFailure(failure)) {
      return null
    }
    throw failure
  }
}

const candidateKeyOf = (candidate: ProductCandidate): string =>
  candidate.productId ?? `${candidate.origin}:${candidate.label}`

const loadVisualCandidates = async (
  database: KairosDatabase,
  embedding: Float32Array,
): Promise<{ candidate: ProductCandidate, similarity: number }[]> => {
  const similarProducts = (await findSimilarProducts(database, embedding, maximumVisualCandidates))
    .filter(similarProduct => similarProduct.similarity >= minimumVisualSimilarity)
  if (similarProducts.length === 0) {
    return []
  }
  const productRows = await database
    .select()
    .from(products)
    .where(inArray(products.id, similarProducts.map(similarProduct => similarProduct.productId)))
  return similarProducts.flatMap((similarProduct) => {
    const productRow = productRows.find(row => row.id === similarProduct.productId)
    return productRow ? [{ candidate: toCatalogueCandidate(productRow), similarity: similarProduct.similarity }] : []
  })
}

export const identifyPhoto = async (
  database: KairosDatabase,
  photo: Buffer,
  dependencies: PhotoIdentificationDependencies,
): Promise<PhotoIdentification> => {
  const now = dependencies.now?.() ?? new Date()
  const uploadFingerprint = createHash('sha256').update(photo).digest('hex')
  const [embedding, recognisedText] = await Promise.all([
    outcomeOrNullWhenUnavailable(
      () => dependencies.embedder.embed(photo),
      failure => failure instanceof ImageEmbedderUnavailableError,
    ),
    outcomeOrNullWhenUnavailable(
      () => dependencies.textReader.read(photo),
      failure => failure instanceof BoxTextReaderUnavailableError,
    ),
  ])

  const degradedReasons: PhotoDegradedReason[] = []
  if (embedding === null) {
    degradedReasons.push('image-embedder-unavailable')
  }
  if (recognisedText === null) {
    degradedReasons.push('text-reader-unavailable')
  }

  const ocrWords = extractSearchWords(recognisedText ?? '')
  const [visualCandidates, textOutcome] = await Promise.all([
    embedding === null ? [] : loadVisualCandidates(database, embedding),
    ocrWords.length === 0
      ? { candidates: [], unavailableSources: [] }
      : dependencies.searchCandidates(ocrWords.join(' ')),
  ])
  if (embedding !== null) {
    cachePhotoEmbedding(uploadFingerprint, embedding, now)
  }

  const candidatesByKey = new Map<string, ProductCandidate>()
  const visualSimilarityByKey = new Map<string, number>()
  for (const { candidate, similarity } of visualCandidates) {
    candidatesByKey.set(candidateKeyOf(candidate), candidate)
    visualSimilarityByKey.set(candidateKeyOf(candidate), similarity)
  }
  for (const candidate of textOutcome.candidates) {
    if (!candidatesByKey.has(candidateKeyOf(candidate))) {
      candidatesByKey.set(candidateKeyOf(candidate), candidate)
    }
  }

  const signals: PhotoCandidateSignal[] = [...candidatesByKey].map(([candidateKey, candidate]) => ({
    productId: candidate.productId,
    candidateKey,
    label: candidate.label,
    visualSimilarity: visualSimilarityByKey.get(candidateKey) ?? null,
    candidateName: candidate.draft.name,
  }))
  const rankedScores = scorePhotoCandidates(signals, ocrWords)
  const rankedCandidates = rankedScores.flatMap(({ candidateKey }) => candidatesByKey.get(candidateKey) ?? [])
  const topCandidate = rankedCandidates[0]
  const autoPicked = topCandidate && topCandidate.productId !== null && shouldAutoPick(rankedScores)
    ? topCandidate
    : null

  return {
    autoPicked,
    candidates: rankedCandidates.slice(0, maximumReturnedCandidates),
    uploadFingerprint,
    ocrWords,
    degradedReasons,
    unavailableSources: textOutcome.unavailableSources,
  }
}

export const confirmPhotoIdentification = async (
  database: KairosDatabase,
  confirmation: { uploadFingerprint: string, productId: string },
  now: Date = new Date(),
): Promise<void> => {
  const cachedEmbedding = findCachedPhotoEmbedding(confirmation.uploadFingerprint, now)
  const [confirmedProduct] = await database
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, confirmation.productId))
  if (cachedEmbedding === null || !confirmedProduct) {
    throw createError({ statusCode: 404, statusMessage: 'Introuvable' })
  }
  await storeProductEmbedding(database, {
    productId: confirmedProduct.id,
    origin: 'confirmed-scan',
    uploadFingerprint: confirmation.uploadFingerprint,
    embedding: cachedEmbedding,
  })
}
