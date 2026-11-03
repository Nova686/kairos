import { Readable } from 'node:stream'
import { fetchCatalogueImage, type ImageHttpResponse, type ImageRequestSender } from '../../../server/domain/scan/fetch-catalogue-image.ts'

const imageResponse = (
  bytes: Uint8Array,
  overrides: Partial<Pick<ImageHttpResponse, 'statusCode' | 'headers'>> = {},
): ImageHttpResponse => ({
  statusCode: 200,
  headers: { 'content-type': 'image/jpeg' },
  body: Readable.from([Buffer.from(bytes)]),
  ...overrides,
})

const redirectResponse = (location: string, statusCode = 302): ImageHttpResponse =>
  imageResponse(new Uint8Array(), { statusCode, headers: { location } })

const publicAddresses = async () => [{ address: '93.184.216.34', family: 4 }]

describe('fetchCatalogueImage', () => {
  it('returns the bytes of an https image', async () => {
    const sendRequest: ImageRequestSender = vi.fn(async () => imageResponse(new Uint8Array([1, 2, 3])))

    const image = await fetchCatalogueImage('https://img.example/a.jpg', { sendRequest, resolveAddresses: publicAddresses })

    expect([...image]).toEqual([1, 2, 3])
  })

  it('refuses a URL that is not http or https without sending anything', async () => {
    const sendRequest = vi.fn()

    await expect(fetchCatalogueImage('file:///etc/passwd', { sendRequest })).rejects.toThrow(/URL/)
    await expect(fetchCatalogueImage('javascript:alert(1)', { sendRequest })).rejects.toThrow(/URL/)
    expect(sendRequest).not.toHaveBeenCalled()
  })

  it.each([
    ['cloud metadata', 'http://169.254.169.254/latest/meta-data'],
    ['loopback', 'http://127.0.0.1/a.jpg'],
    ['private', 'http://10.0.0.1/a.jpg'],
    ['IPv6 loopback', 'http://[::1]/a.jpg'],
    ['IPv4-mapped loopback', 'http://[::ffff:127.0.0.1]/a.jpg'],
    ['decimal loopback', 'http://2130706433/a.jpg'],
  ])('refuses a literal %s address without sending anything', async (_label, imageUrl) => {
    const sendRequest = vi.fn()

    await expect(fetchCatalogueImage(imageUrl, { sendRequest })).rejects.toThrow(/adresse|address/i)
    expect(sendRequest).not.toHaveBeenCalled()
  })

  it('refuses a host name that resolves to a private address before connecting', async () => {
    const resolveAddresses = async () => [{ address: '10.0.0.1', family: 4 }]

    await expect(fetchCatalogueImage('http://internal.example/a.jpg', { resolveAddresses })).rejects.toThrow(/adresse|address/i)
  })

  it('refuses a host name when any of its addresses is private', async () => {
    const resolveAddresses = async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ]

    await expect(fetchCatalogueImage('http://rebind.example/a.jpg', { resolveAddresses })).rejects.toThrow(/adresse|address/i)
  })

  it('follows a redirect to a public image', async () => {
    const sendRequest: ImageRequestSender = vi
      .fn<ImageRequestSender>()
      .mockResolvedValueOnce(redirectResponse('https://cdn.example/b.jpg'))
      .mockResolvedValueOnce(imageResponse(new Uint8Array([9])))

    const image = await fetchCatalogueImage('https://img.example/a.jpg', { sendRequest, resolveAddresses: publicAddresses })

    expect([...image]).toEqual([9])
    expect(sendRequest).toHaveBeenCalledTimes(2)
  })

  it('refuses a redirect to a private address', async () => {
    const sendRequest: ImageRequestSender = vi
      .fn<ImageRequestSender>()
      .mockResolvedValueOnce(redirectResponse('http://169.254.169.254/latest/meta-data'))

    await expect(
      fetchCatalogueImage('https://img.example/a.jpg', { sendRequest, resolveAddresses: publicAddresses }),
    ).rejects.toThrow(/adresse|address/i)
    expect(sendRequest).toHaveBeenCalledTimes(1)
  })

  it('refuses a redirect to a non-http scheme', async () => {
    const sendRequest: ImageRequestSender = vi.fn<ImageRequestSender>().mockResolvedValueOnce(redirectResponse('file:///etc/passwd'))

    await expect(
      fetchCatalogueImage('https://img.example/a.jpg', { sendRequest, resolveAddresses: publicAddresses }),
    ).rejects.toThrow(/URL/)
  })

  it('gives up after three redirects', async () => {
    const sendRequest: ImageRequestSender = vi.fn<ImageRequestSender>(async () => redirectResponse('https://img.example/next.jpg'))

    await expect(
      fetchCatalogueImage('https://img.example/a.jpg', { sendRequest, resolveAddresses: publicAddresses }),
    ).rejects.toThrow(/redirection/i)
    expect(sendRequest).toHaveBeenCalledTimes(4)
  })

  it('refuses a response that is not an image', async () => {
    const sendRequest: ImageRequestSender = async () =>
      imageResponse(new Uint8Array([1]), { headers: { 'content-type': 'text/html' } })

    await expect(
      fetchCatalogueImage('https://img.example/a.jpg', { sendRequest, resolveAddresses: publicAddresses }),
    ).rejects.toThrow(/content-type|image/i)
  })

  it('refuses a non-successful response', async () => {
    const sendRequest: ImageRequestSender = async () => imageResponse(new Uint8Array(), { statusCode: 404 })

    await expect(
      fetchCatalogueImage('https://img.example/a.jpg', { sendRequest, resolveAddresses: publicAddresses }),
    ).rejects.toThrow(/404/)
  })

  it('refuses an image announced larger than the cap', async () => {
    const sendRequest: ImageRequestSender = async () =>
      imageResponse(new Uint8Array(4), { headers: { 'content-type': 'image/png', 'content-length': '100' } })

    await expect(
      fetchCatalogueImage('https://img.example/a.jpg', { sendRequest, resolveAddresses: publicAddresses, maxBytes: 10 }),
    ).rejects.toThrow(/volumineuse/)
  })

  it('stops reading an image that exceeds the cap without announcing its size', async () => {
    const sendRequest: ImageRequestSender = async () => imageResponse(new Uint8Array(50))

    await expect(
      fetchCatalogueImage('https://img.example/a.jpg', { sendRequest, resolveAddresses: publicAddresses, maxBytes: 10 }),
    ).rejects.toThrow(/volumineuse/)
  })

  it('aborts a request that takes longer than the timeout', async () => {
    const sendRequest: ImageRequestSender = (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason))
      })

    await expect(
      fetchCatalogueImage('https://img.example/a.jpg', { sendRequest, resolveAddresses: publicAddresses, timeoutMs: 20 }),
    ).rejects.toThrow()
  })
})
