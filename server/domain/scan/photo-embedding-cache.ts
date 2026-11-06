const cacheLifetimeMilliseconds = 15 * 60 * 1000
const maximumCachedEmbeddings = 200

type CachedPhotoEmbedding = { embedding: Float32Array, cachedAt: number }

const cachedEmbeddings = new Map<string, CachedPhotoEmbedding>()

export const cachePhotoEmbedding = (uploadFingerprint: string, embedding: Float32Array, now: Date): void => {
  cachedEmbeddings.delete(uploadFingerprint)
  cachedEmbeddings.set(uploadFingerprint, { embedding, cachedAt: now.getTime() })
  while (cachedEmbeddings.size > maximumCachedEmbeddings) {
    const oldestFingerprint = cachedEmbeddings.keys().next().value
    if (oldestFingerprint === undefined) {
      return
    }
    cachedEmbeddings.delete(oldestFingerprint)
  }
}

export const findCachedPhotoEmbedding = (uploadFingerprint: string, now: Date): Float32Array | null => {
  const cachedEmbedding = cachedEmbeddings.get(uploadFingerprint)
  if (!cachedEmbedding) {
    return null
  }
  if (now.getTime() - cachedEmbedding.cachedAt >= cacheLifetimeMilliseconds) {
    cachedEmbeddings.delete(uploadFingerprint)
    return null
  }
  return cachedEmbedding.embedding
}
