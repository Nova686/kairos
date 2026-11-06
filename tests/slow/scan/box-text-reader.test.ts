import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createTesseractBoxTextReader } from '../../../server/domain/scan/box-text-reader.ts'

const languageDirectory = resolve(process.cwd(), process.env.NUXT_TESSERACT_DIRECTORY ?? '.data/tesseract')
const downloadTimeoutMilliseconds = 240_000

describe('Tesseract box text reader', () => {
  it('reads the title printed on the ETB fixture', async () => {
    const reader = createTesseractBoxTextReader(languageDirectory, { downloadTimeoutMs: downloadTimeoutMilliseconds })
    const fixture = readFileSync(resolve(process.cwd(), 'tests/fixtures/scan/etb-box.jpg'))

    const text = await reader.read(fixture)
    await reader.close()

    expect(text.toLowerCase()).toContain('prismatiques')
  })
})
