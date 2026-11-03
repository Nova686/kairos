import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClipImageEmbedder } from '../../../server/domain/scan/image-embedder.ts'

const modelsDirectory = resolve(process.cwd(), process.env.NUXT_MODELS_DIRECTORY ?? '.data/models')
const downloadTimeoutMilliseconds = 240_000

describe('CLIP image embedder', () => {
  it('embeds the ETB fixture into 512 finite values of unit norm', async () => {
    const embedder = createClipImageEmbedder(modelsDirectory, { downloadTimeoutMs: downloadTimeoutMilliseconds })
    const fixture = readFileSync(resolve(process.cwd(), 'tests/fixtures/scan/etb-box.jpg'))

    const embedding = await embedder.embed(fixture)

    expect(embedding).toHaveLength(512)
    expect([...embedding].every(Number.isFinite)).toBe(true)
    const norm = Math.sqrt([...embedding].reduce((squaredSum, component) => squaredSum + component * component, 0))
    expect(norm).toBeCloseTo(1, 4)
  })
})
