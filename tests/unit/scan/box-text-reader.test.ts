import { BoxTextReaderUnavailableError, createTesseractBoxTextReader } from '../../../server/domain/scan/box-text-reader.ts'
import type { BoxTextRecognizer } from '../../../server/domain/scan/box-text-reader.ts'

describe('createTesseractBoxTextReader', () => {
  it('creates the recognizer lazily, once, and reuses it', async () => {
    const loadRecognizer = vi.fn(async (): Promise<BoxTextRecognizer> => ({ recognize: async () => 'Coffret' }))
    const reader = createTesseractBoxTextReader('.data/tesseract', { loadRecognizer })

    expect(loadRecognizer).not.toHaveBeenCalled()
    expect(await reader.read(Buffer.from('a'))).toBe('Coffret')
    expect(await reader.read(Buffer.from('b'))).toBe('Coffret')
    expect(loadRecognizer).toHaveBeenCalledTimes(1)
    expect(loadRecognizer).toHaveBeenCalledWith('.data/tesseract')
  })

  it('reports a loading failure as unavailable and retries on the next read', async () => {
    const loadRecognizer = vi.fn<() => Promise<BoxTextRecognizer>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ recognize: async () => 'ok' })
    const reader = createTesseractBoxTextReader('dir', { loadRecognizer })

    await expect(reader.read(Buffer.from('a'))).rejects.toBeInstanceOf(BoxTextReaderUnavailableError)
    expect(await reader.read(Buffer.from('a'))).toBe('ok')
  })

  it('reuses a language data download that finished after timing out instead of starting a second worker', async () => {
    let finishLoading: (recognizer: BoxTextRecognizer) => void = () => undefined
    const loadRecognizer = vi.fn(() => new Promise<BoxTextRecognizer>((resolve) => {
      finishLoading = resolve
    }))
    const reader = createTesseractBoxTextReader('dir', { loadRecognizer, downloadTimeoutMs: 20 })
    await expect(reader.read(Buffer.from('a'))).rejects.toBeInstanceOf(BoxTextReaderUnavailableError)

    finishLoading({ recognize: async () => 'Coffret' })

    expect(await reader.read(Buffer.from('a'))).toBe('Coffret')
    expect(loadRecognizer).toHaveBeenCalledTimes(1)
  })

  it('terminates the loaded worker on close and loads a new one on the next read', async () => {
    const terminate = vi.fn(async () => undefined)
    const loadRecognizer = vi.fn(async (): Promise<BoxTextRecognizer> => ({ recognize: async () => 'Coffret', terminate }))
    const reader = createTesseractBoxTextReader('dir', { loadRecognizer })
    await reader.read(Buffer.from('a'))

    await reader.close()
    await reader.read(Buffer.from('b'))

    expect(terminate).toHaveBeenCalledTimes(1)
    expect(loadRecognizer).toHaveBeenCalledTimes(2)
  })

  it('closes quietly when nothing was loaded or when the worker still loading fails', async () => {
    let failLoading: (loadingError: Error) => void = () => undefined
    const neverLoadedReader = createTesseractBoxTextReader('dir', { loadRecognizer: vi.fn() })
    const failingReader = createTesseractBoxTextReader('dir', {
      loadRecognizer: () => new Promise<BoxTextRecognizer>((_resolve, reject) => {
        failLoading = reject
      }),
    })
    const pendingRead = failingReader.read(Buffer.from('a'))

    const closing = failingReader.close()
    failLoading(new Error('offline'))

    await expect(pendingRead).rejects.toBeInstanceOf(BoxTextReaderUnavailableError)
    await expect(closing).resolves.toBeUndefined()
    await expect(neverLoadedReader.close()).resolves.toBeUndefined()
  })

  it('times out a stuck language data download', async () => {
    const loadRecognizer = vi.fn(() => new Promise<BoxTextRecognizer>(() => {}))
    const reader = createTesseractBoxTextReader('dir', { loadRecognizer, downloadTimeoutMs: 20 })

    await expect(reader.read(Buffer.from('a'))).rejects.toThrow(/unavailable.*timed out/i)
  })
})
