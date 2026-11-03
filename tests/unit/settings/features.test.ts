import { describeServerFeatures } from '../../../server/domain/settings/describe-server-features.ts'
import {
  assertPhotoRecognitionEnabled,
  createPhotoRecognitionEngines,
  isPhotoRecognitionEnabled,
  photoRecognitionDisabledMessage,
} from '../../../server/domain/scan/photo-recognition-mode.ts'
import { embedCatalogueImagesWhenEnabled } from '../../../server/domain/scan/embed-catalogue-images-when-enabled.ts'

describe('server features', () => {
  it('reports photo recognition as available unless the mode is off', () => {
    expect(describeServerFeatures('on')).toEqual({ photoRecognition: true })
    expect(describeServerFeatures('')).toEqual({ photoRecognition: true })
    expect(describeServerFeatures('off')).toEqual({ photoRecognition: false })
    expect(isPhotoRecognitionEnabled('off')).toBe(false)
  })
})

describe('photo recognition mode', () => {
  it('answers 503 with the French message when the mode is off', () => {
    expect(photoRecognitionDisabledMessage).toBe('reconnaissance photo désactivée sur ce serveur')
    expect(() => assertPhotoRecognitionEnabled('off')).toThrowError(photoRecognitionDisabledMessage)
    let statusCode = 0
    try {
      assertPhotoRecognitionEnabled('off')
    }
    catch (failure) {
      statusCode = (failure as { statusCode: number }).statusCode
    }
    expect(statusCode).toBe(503)
    expect(() => assertPhotoRecognitionEnabled('on')).not.toThrow()
  })

  it('never constructs the embedder nor the text reader when the mode is off', () => {
    const createEmbedder = vi.fn()
    const createTextReader = vi.fn()

    expect(() => createPhotoRecognitionEngines('off', { createEmbedder, createTextReader })).toThrowError(photoRecognitionDisabledMessage)

    expect(createEmbedder).not.toHaveBeenCalled()
    expect(createTextReader).not.toHaveBeenCalled()
  })

  it('constructs both engines when the mode is on', () => {
    const embedder = { embed: vi.fn() }
    const textReader = { read: vi.fn(), close: vi.fn() }

    const engines = createPhotoRecognitionEngines('on', { createEmbedder: () => embedder, createTextReader: () => textReader })

    expect(engines).toEqual({ embedder, textReader })
  })
})

describe('catalogue image embedding task', () => {
  it('returns immediately without touching the database or the embedder when the mode is off', async () => {
    const createEmbedder = vi.fn()
    const embedCatalogueImages = vi.fn()

    const summary = await embedCatalogueImagesWhenEnabled('off', {
      createEmbedder,
      openDatabase: () => Promise.reject(new Error('must not open the database')),
      embedCatalogueImages,
      now: new Date(),
    })

    expect(summary).toEqual({ embeddedCount: 0, failedCount: 0 })
    expect(createEmbedder).not.toHaveBeenCalled()
    expect(embedCatalogueImages).not.toHaveBeenCalled()
  })

  it('embeds with the created embedder when the mode is on', async () => {
    const embedder = { embed: vi.fn() }
    const database = {} as never
    const now = new Date()
    const embedCatalogueImages = vi.fn().mockResolvedValue({ embeddedCount: 2, failedCount: 1 })

    const summary = await embedCatalogueImagesWhenEnabled('on', {
      createEmbedder: () => embedder,
      openDatabase: () => Promise.resolve(database),
      embedCatalogueImages,
      now,
    })

    expect(summary).toEqual({ embeddedCount: 2, failedCount: 1 })
    expect(embedCatalogueImages).toHaveBeenCalledWith(database, { embedder, now })
  })
})
