import { shareSlowLoad } from './share-slow-load.ts'

export type BoxTextReader = {
  read(image: Buffer): Promise<string>
  close(): Promise<void>
}

export type BoxTextRecognizer = {
  recognize(image: Buffer): Promise<string>
  terminate?(): Promise<void>
}

export class BoxTextReaderUnavailableError extends Error {
  constructor(loadingError: unknown) {
    super(`Box text reader unavailable: ${loadingError instanceof Error ? loadingError.message : String(loadingError)}`, {
      cause: loadingError,
    })
    this.name = 'BoxTextReaderUnavailableError'
  }
}

export type TesseractBoxTextReaderOptions = {
  loadRecognizer?: (languageDirectory: string) => Promise<BoxTextRecognizer>
  downloadTimeoutMs?: number
}

export const boxTextLanguages = ['fra', 'eng']
export const defaultLanguageDownloadTimeoutMilliseconds = 120_000

const loadTesseractRecognizer = async (languageDirectory: string): Promise<BoxTextRecognizer> => {
  const { createWorker } = await import('tesseract.js')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(languageDirectory, { recursive: true })
  const worker = await createWorker(boxTextLanguages, 1, { cachePath: languageDirectory })
  return {
    recognize: async (image) => {
      const recognition = await worker.recognize(image)
      return recognition.data.text
    },
    terminate: async () => {
      await worker.terminate()
    },
  }
}

export const createTesseractBoxTextReader = (
  languageDirectory: string,
  options: TesseractBoxTextReaderOptions = {},
): BoxTextReader => {
  const { loadRecognizer = loadTesseractRecognizer, downloadTimeoutMs = defaultLanguageDownloadTimeoutMilliseconds } = options
  const recognizerLoad = shareSlowLoad(() => loadRecognizer(languageDirectory), {
    timeoutMs: downloadTimeoutMs,
    describeTimeout: timeoutMs =>
      `OCR language data download timed out after ${timeoutMs} ms: check the network or proxy access to the tesseract.js language data`,
  })
  const obtainRecognizer = (): Promise<BoxTextRecognizer> =>
    recognizerLoad.obtain().catch((loadingError: unknown) => {
      throw new BoxTextReaderUnavailableError(loadingError)
    })
  return {
    read: async image => (await obtainRecognizer()).recognize(image),
    close: async () => {
      await recognizerLoad.release()?.then(recognizer => recognizer.terminate?.(), () => undefined)
    },
  }
}

let sharedReader: BoxTextReader | null = null

export const sharedTesseractBoxTextReader = (languageDirectory: string): BoxTextReader => {
  sharedReader ??= createTesseractBoxTextReader(languageDirectory)
  return sharedReader
}
