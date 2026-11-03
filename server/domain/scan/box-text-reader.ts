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

const withDownloadTimeout = <Loaded>(loading: Promise<Loaded>, timeoutMs: number): Promise<Loaded> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`OCR language data download timed out after ${timeoutMs} ms: check the network or proxy access to the tesseract.js language data`)),
      timeoutMs,
    )
  })
  return Promise.race([loading, timeout]).finally(() => clearTimeout(timer))
}

export const createTesseractBoxTextReader = (
  languageDirectory: string,
  options: TesseractBoxTextReaderOptions = {},
): BoxTextReader => {
  const { loadRecognizer = loadTesseractRecognizer, downloadTimeoutMs = defaultLanguageDownloadTimeoutMilliseconds } = options
  let loadingRecognizer: ReturnType<typeof loadRecognizer> | null = null
  const obtainRecognizer = (): ReturnType<typeof loadRecognizer> => {
    loadingRecognizer ??= withDownloadTimeout(loadRecognizer(languageDirectory), downloadTimeoutMs).catch((loadingError) => {
      loadingRecognizer = null
      throw new BoxTextReaderUnavailableError(loadingError)
    })
    return loadingRecognizer
  }
  return {
    read: async image => (await obtainRecognizer()).recognize(image),
    close: async () => {
      const closingRecognizer = loadingRecognizer
      loadingRecognizer = null
      await (await closingRecognizer)?.terminate?.()
    },
  }
}

let sharedReader: BoxTextReader | null = null

export const sharedTesseractBoxTextReader = (languageDirectory: string): BoxTextReader => {
  sharedReader ??= createTesseractBoxTextReader(languageDirectory)
  return sharedReader
}
