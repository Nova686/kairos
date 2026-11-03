export type ImageEmbedder = { embed(image: Buffer): Promise<Float32Array> }

export class ImageEmbedderUnavailableError extends Error {
  constructor(loadingError: unknown) {
    super(`Image embedding model unavailable: ${loadingError instanceof Error ? loadingError.message : String(loadingError)}`, {
      cause: loadingError,
    })
    this.name = 'ImageEmbedderUnavailableError'
  }
}

export type ImageFeatureExtractor = (image: Buffer) => Promise<Float32Array>

export type ClipImageEmbedderOptions = {
  loadExtractor?: (modelsDirectory: string) => Promise<ImageFeatureExtractor>
  downloadTimeoutMs?: number
}

export const clipModelName = 'Xenova/clip-vit-base-patch32'
export const defaultModelDownloadTimeoutMilliseconds = 300_000

export const l2Normalise = (vector: Float32Array): Float32Array => {
  let squaredSum = 0
  for (const component of vector) {
    squaredSum += component * component
  }
  if (squaredSum === 0) {
    throw new Error('Cannot normalise a zero vector')
  }
  const norm = Math.sqrt(squaredSum)
  return vector.map(component => component / norm)
}

const loadTransformersExtractor = async (modelsDirectory: string): Promise<ImageFeatureExtractor> => {
  const { pipeline, RawImage } = await import('@huggingface/transformers')
  const extractor = await pipeline('image-feature-extraction', clipModelName, { cache_dir: modelsDirectory })
  return async (image) => {
    const rawImage = await RawImage.fromBlob(new Blob([new Uint8Array(image)]))
    const features = await extractor(rawImage)
    return Float32Array.from(features.data as Float32Array)
  }
}

const withDownloadTimeout = <Loaded>(loading: Promise<Loaded>, timeoutMs: number): Promise<Loaded> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Model download timed out after ${timeoutMs} ms: check the network or proxy access to huggingface.co`)),
      timeoutMs,
    )
  })
  return Promise.race([loading, timeout]).finally(() => clearTimeout(timer))
}

export const createClipImageEmbedder = (
  modelsDirectory: string,
  options: ClipImageEmbedderOptions = {},
): ImageEmbedder => {
  const { loadExtractor = loadTransformersExtractor, downloadTimeoutMs = defaultModelDownloadTimeoutMilliseconds } = options
  let loadingExtractor: Promise<ImageFeatureExtractor> | null = null
  const obtainExtractor = (): Promise<ImageFeatureExtractor> => {
    loadingExtractor ??= withDownloadTimeout(loadExtractor(modelsDirectory), downloadTimeoutMs).catch((loadingError) => {
      loadingExtractor = null
      throw new ImageEmbedderUnavailableError(loadingError)
    })
    return loadingExtractor
  }
  return {
    embed: async (image) => l2Normalise(await (await obtainExtractor())(image)),
  }
}

let sharedEmbedder: ImageEmbedder | null = null

export const sharedClipImageEmbedder = (modelsDirectory: string): ImageEmbedder => {
  sharedEmbedder ??= createClipImageEmbedder(modelsDirectory)
  return sharedEmbedder
}
