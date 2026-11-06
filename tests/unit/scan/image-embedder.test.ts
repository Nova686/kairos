import {
  createClipImageEmbedder,
  ImageEmbedderUnavailableError,
  l2Normalise,
  sharedClipImageEmbedder,
  type ImageFeatureExtractor,
} from '../../../server/domain/scan/image-embedder.ts'

const extractorReturning = (values: number[]): ImageFeatureExtractor => async () => Float32Array.from(values)

describe('l2Normalise', () => {
  it('scales a vector to unit length', () => {
    const normalised = l2Normalise(Float32Array.from([3, 4]))

    expect(normalised[0]).toBeCloseTo(0.6, 6)
    expect(normalised[1]).toBeCloseTo(0.8, 6)
  })

  it('refuses a zero vector', () => {
    expect(() => l2Normalise(new Float32Array(4))).toThrow(/zero/i)
  })
})

describe('createClipImageEmbedder', () => {
  it('loads nothing until the first embed and loads once for several images', async () => {
    const loadExtractor = vi.fn(async () => extractorReturning([3, 4]))
    const embedder = createClipImageEmbedder('.data/models', { loadExtractor })
    expect(loadExtractor).not.toHaveBeenCalled()

    const first = await embedder.embed(Buffer.from([1]))
    await embedder.embed(Buffer.from([2]))

    expect(loadExtractor).toHaveBeenCalledTimes(1)
    expect(loadExtractor).toHaveBeenCalledWith('.data/models')
    expect(first[0]).toBeCloseTo(0.6, 6)
  })

  it('retries loading after a failed attempt', async () => {
    const loadExtractor = vi
      .fn<(modelsDirectory: string) => Promise<ImageFeatureExtractor>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(extractorReturning([1, 0]))
    const embedder = createClipImageEmbedder('.data/models', { loadExtractor })

    await expect(embedder.embed(Buffer.from([1]))).rejects.toBeInstanceOf(ImageEmbedderUnavailableError)
    const embedding = await embedder.embed(Buffer.from([1]))

    expect(embedding[0]).toBe(1)
  })

  it('fails with an explicit message when the model download exceeds the timeout', async () => {
    const loadExtractor = () => new Promise<ImageFeatureExtractor>(() => undefined)
    const embedder = createClipImageEmbedder('.data/models', { loadExtractor, downloadTimeoutMs: 20 })

    await expect(embedder.embed(Buffer.from([1]))).rejects.toThrow(/download/i)
    await expect(embedder.embed(Buffer.from([1]))).rejects.toBeInstanceOf(ImageEmbedderUnavailableError)
  })

  it('keeps waiting for a timed-out download instead of starting a second one', async () => {
    let finishDownload: (extractor: ImageFeatureExtractor) => void = () => undefined
    const loadExtractor = vi.fn(() => new Promise<ImageFeatureExtractor>((resolve) => {
      finishDownload = resolve
    }))
    const embedder = createClipImageEmbedder('.data/models', { loadExtractor, downloadTimeoutMs: 20 })
    await expect(embedder.embed(Buffer.from([1]))).rejects.toBeInstanceOf(ImageEmbedderUnavailableError)

    const secondEmbedding = embedder.embed(Buffer.from([1]))
    finishDownload(extractorReturning([0, 1]))

    expect((await secondEmbedding)[1]).toBe(1)
    expect(loadExtractor).toHaveBeenCalledTimes(1)
  })

  it('lets an image decoding error through without calling it a model failure', async () => {
    const decodingFailure: ImageFeatureExtractor = async () => {
      throw new Error('unsupported image')
    }
    const embedder = createClipImageEmbedder('.data/models', { loadExtractor: async () => decodingFailure })

    const rejection = await embedder.embed(Buffer.from([1])).catch((embeddingError: unknown) => embeddingError)

    expect(rejection).not.toBeInstanceOf(ImageEmbedderUnavailableError)
    expect((rejection as Error).message).toBe('unsupported image')
  })
})

describe('sharedClipImageEmbedder', () => {
  it('always returns the same instance', () => {
    expect(sharedClipImageEmbedder('.data/models')).toBe(sharedClipImageEmbedder('.data/models'))
  })
})
