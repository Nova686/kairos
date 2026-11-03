import { fetchCatalogueImage } from '../../../server/domain/scan/fetch-catalogue-image.ts'

const imageResponse = (bytes: Uint8Array, init: ResponseInit = {}): Response => new Response(Buffer.from(bytes), { status: 200, ...init })

describe('fetchCatalogueImage', () => {
  it('returns the bytes of an https image', async () => {
    const fetchImage = vi.fn(async () => imageResponse(new Uint8Array([1, 2, 3])))

    const image = await fetchCatalogueImage('https://img.example/a.jpg', { fetchImage })

    expect([...image]).toEqual([1, 2, 3])
  })

  it('refuses a URL that is not http or https without fetching', async () => {
    const fetchImage = vi.fn()

    await expect(fetchCatalogueImage('file:///etc/passwd', { fetchImage })).rejects.toThrow(/URL/)
    await expect(fetchCatalogueImage('javascript:alert(1)', { fetchImage })).rejects.toThrow(/URL/)
    expect(fetchImage).not.toHaveBeenCalled()
  })

  it('refuses a non-successful response', async () => {
    const fetchImage = async () => new Response('nope', { status: 404 })

    await expect(fetchCatalogueImage('https://img.example/a.jpg', { fetchImage })).rejects.toThrow(/404/)
  })

  it('refuses an image announced larger than the cap', async () => {
    const fetchImage = async () => imageResponse(new Uint8Array(4), { headers: { 'content-length': '100' } })

    await expect(fetchCatalogueImage('https://img.example/a.jpg', { fetchImage, maxBytes: 10 })).rejects.toThrow(/volumineuse|large/i)
  })

  it('stops reading an image that exceeds the cap without announcing its size', async () => {
    const fetchImage = async () => imageResponse(new Uint8Array(50))

    await expect(fetchCatalogueImage('https://img.example/a.jpg', { fetchImage, maxBytes: 10 })).rejects.toThrow(/volumineuse|large/i)
  })

  it('aborts a request that takes longer than the timeout', async () => {
    const fetchImage = (_url: string, init: { signal: AbortSignal }) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason))
      })

    await expect(fetchCatalogueImage('https://img.example/a.jpg', { fetchImage, timeoutMs: 20 })).rejects.toThrow()
  })
})
