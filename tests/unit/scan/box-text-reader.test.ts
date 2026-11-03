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

  it('times out a stuck language data download', async () => {
    const loadRecognizer = vi.fn(() => new Promise<BoxTextRecognizer>(() => {}))
    const reader = createTesseractBoxTextReader('dir', { loadRecognizer, downloadTimeoutMs: 20 })

    await expect(reader.read(Buffer.from('a'))).rejects.toThrow(/unavailable.*timed out/i)
  })
})
