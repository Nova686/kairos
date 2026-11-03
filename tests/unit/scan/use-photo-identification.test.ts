import type { Mock } from 'vitest'
import { usePhotoIdentification } from '../../../app/composables/usePhotoIdentification.ts'
import type { ScanRequestSender } from '../../../app/composables/useScanIdentification.ts'

const coffret = { id: 'product-1', name: 'Coffret Dresseur Elite', category: 'pokemon-sealed' as const }

const candidateFor = (productId: string | null, label: string) => ({
  origin: 'catalogue' as const,
  label,
  imageUrl: null,
  productId,
  draft: { name: label, category: 'pokemon-sealed' as const },
})

const photoFile = new File([new Uint8Array([1, 2, 3])], 'box.heic', { type: 'image/heic' })
const resizedBlob = new Blob([new Uint8Array([9])], { type: 'image/jpeg' })

const outcomeWith = (overrides: Record<string, unknown>) => ({
  autoPicked: null,
  candidates: [],
  uploadFingerprint: 'fingerprint-1',
  ocrWords: [],
  degradedReasons: [],
  unavailableSources: [],
  ...overrides,
})

const buildComposable = (sendRequest: Mock) => {
  const onProductReady = vi.fn()
  const onProductWithdrawn = vi.fn()
  const photo = usePhotoIdentification(
    { onProductReady, onProductWithdrawn },
    sendRequest as unknown as ScanRequestSender,
    async () => resizedBlob,
  )
  return { photo, onProductReady, onProductWithdrawn }
}

describe('usePhotoIdentification', () => {
  it('uploads the resized photo as multipart and goes straight to an auto-picked product', async () => {
    const sendRequest = vi.fn().mockResolvedValue(
      outcomeWith({ autoPicked: candidateFor(coffret.id, coffret.name), candidates: [candidateFor(coffret.id, coffret.name)] }),
    )
    const { photo, onProductReady } = buildComposable(sendRequest)

    await photo.analyse(photoFile)

    const [url, options] = sendRequest.mock.calls[0]!
    expect(url).toBe('/api/scan/photo')
    expect(options.method).toBe('POST')
    expect((options.body as FormData).get('photo')).toBeInstanceOf(Blob)
    expect(onProductReady).toHaveBeenCalledWith(coffret)
    expect(photo.autoPickedProduct.value).toEqual(coffret)
    expect(photo.isAnalysing.value).toBe(false)
  })

  it('withdraws the auto-picked product and shows the candidates on « Ce n’est pas le bon »', async () => {
    const candidates = [candidateFor(coffret.id, coffret.name), candidateFor('product-2', 'Display')]
    const sendRequest = vi.fn().mockResolvedValue(outcomeWith({ autoPicked: candidates[0], candidates }))
    const { photo, onProductWithdrawn } = buildComposable(sendRequest)
    await photo.analyse(photoFile)

    photo.rejectAutoPick()

    expect(onProductWithdrawn).toHaveBeenCalledWith(coffret.id)
    expect(photo.autoPickedProduct.value).toBeNull()
    expect(photo.candidates.value).toEqual(candidates)
  })

  it('hands a picked candidate over without confirming it before a purchase', async () => {
    const sendRequest = vi.fn()
      .mockResolvedValueOnce(outcomeWith({ candidates: [candidateFor(coffret.id, coffret.name)] }))
    const { photo, onProductReady } = buildComposable(sendRequest)
    await photo.analyse(photoFile)

    await photo.pickProduct(coffret)
    await photo.confirmPurchasedPick([])

    expect(onProductReady).toHaveBeenCalledWith(coffret)
    expect(sendRequest).toHaveBeenCalledTimes(1)
  })

  it('confirms only the purchased product after a mis-tap then a correct pick', async () => {
    const display = { id: 'product-2', name: 'Display', category: 'pokemon-sealed' as const }
    const sendRequest = vi.fn()
      .mockResolvedValueOnce(outcomeWith({ candidates: [candidateFor(coffret.id, coffret.name), candidateFor(display.id, display.name)] }))
      .mockResolvedValueOnce({ confirmed: true })
    const { photo } = buildComposable(sendRequest)
    await photo.analyse(photoFile)

    await photo.pickProduct(coffret)
    await photo.pickProduct(display)
    await photo.confirmPurchasedPick([display.id])

    expect(sendRequest).toHaveBeenCalledTimes(2)
    expect(sendRequest).toHaveBeenLastCalledWith('/api/scan/photo/confirm', {
      method: 'POST',
      body: { uploadFingerprint: 'fingerprint-1', productId: display.id },
    })
  })

  it('confirms the first picked product when several picked products were purchased', async () => {
    const display = { id: 'product-2', name: 'Display', category: 'pokemon-sealed' as const }
    const sendRequest = vi.fn()
      .mockResolvedValueOnce(outcomeWith({ autoPicked: candidateFor(coffret.id, coffret.name) }))
      .mockResolvedValueOnce({ confirmed: true })
    const { photo } = buildComposable(sendRequest)
    await photo.analyse(photoFile)
    await photo.pickProduct(display)

    await photo.confirmPurchasedPick([display.id, coffret.id])

    expect(sendRequest).toHaveBeenCalledTimes(2)
    expect(sendRequest).toHaveBeenLastCalledWith('/api/scan/photo/confirm', {
      method: 'POST',
      body: { uploadFingerprint: 'fingerprint-1', productId: coffret.id },
    })
  })

  it('confirms nothing when no picked product was purchased', async () => {
    const sendRequest = vi.fn().mockResolvedValue(outcomeWith({ candidates: [candidateFor(coffret.id, coffret.name)] }))
    const { photo } = buildComposable(sendRequest)
    await photo.analyse(photoFile)
    await photo.pickProduct(coffret)

    await photo.confirmPurchasedPick(['another-product'])

    expect(sendRequest).toHaveBeenCalledTimes(1)
  })

  it('forgets earlier picks when a new photo is analysed', async () => {
    const sendRequest = vi.fn().mockResolvedValue(outcomeWith({ candidates: [candidateFor(coffret.id, coffret.name)] }))
    const { photo } = buildComposable(sendRequest)
    await photo.analyse(photoFile)
    await photo.pickProduct(coffret)
    await photo.analyse(photoFile)

    await photo.confirmPurchasedPick([coffret.id])

    expect(sendRequest).toHaveBeenCalledTimes(2)
  })

  it('still confirms without surfacing an error when the confirmation fails', async () => {
    const sendRequest = vi.fn()
      .mockResolvedValueOnce(outcomeWith({ candidates: [candidateFor(coffret.id, coffret.name)] }))
      .mockRejectedValueOnce({ statusCode: 404 })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { photo } = buildComposable(sendRequest)
    await photo.analyse(photoFile)
    await photo.pickProduct(coffret)

    await photo.confirmPurchasedPick([coffret.id])

    expect(photo.errorMessage.value).toBe('')
    expect(warning).toHaveBeenCalledTimes(1)
    warning.mockRestore()
  })

  it('does not confirm at auto-pick time, only once a purchase still containing the product is recorded', async () => {
    const sendRequest = vi.fn()
      .mockResolvedValueOnce(outcomeWith({ autoPicked: candidateFor(coffret.id, coffret.name) }))
      .mockResolvedValueOnce({ confirmed: true })
    const { photo } = buildComposable(sendRequest)
    await photo.analyse(photoFile)

    expect(sendRequest).toHaveBeenCalledTimes(1)
    await photo.confirmPurchasedPick(['another-product'])
    expect(sendRequest).toHaveBeenCalledTimes(1)
    await photo.confirmPurchasedPick([coffret.id])

    expect(sendRequest).toHaveBeenLastCalledWith('/api/scan/photo/confirm', {
      method: 'POST',
      body: { uploadFingerprint: 'fingerprint-1', productId: coffret.id },
    })
  })

  it('does not confirm a rejected auto-pick', async () => {
    const sendRequest = vi.fn().mockResolvedValue(outcomeWith({ autoPicked: candidateFor(coffret.id, coffret.name) }))
    const { photo } = buildComposable(sendRequest)
    await photo.analyse(photoFile)
    photo.rejectAutoPick()

    await photo.confirmPurchasedPick([coffret.id])

    expect(sendRequest).toHaveBeenCalledTimes(1)
  })

  it('translates degraded reasons into French messages', async () => {
    const sendRequest = vi.fn().mockResolvedValue(
      outcomeWith({ degradedReasons: ['image-embedder-unavailable', 'text-reader-unavailable'] }),
    )
    const { photo } = buildComposable(sendRequest)

    await photo.analyse(photoFile)

    expect(photo.degradedMessages.value).toEqual([
      'La reconnaissance visuelle est indisponible pour le moment.',
      'La lecture du texte est indisponible pour le moment.',
    ])
  })

  it('shows the server message on failure', async () => {
    const sendRequest = vi.fn().mockRejectedValue({ data: { statusMessage: 'Photo trop lourde : 5 Mo maximum.' } })
    const { photo } = buildComposable(sendRequest)

    await photo.analyse(photoFile)

    expect(photo.errorMessage.value).toBe('Photo trop lourde : 5 Mo maximum.')
    expect(photo.isAnalysing.value).toBe(false)
  })

  it('ignores a second photo while one is being analysed', async () => {
    let releaseUpload: (value: unknown) => void = () => {}
    const sendRequest = vi.fn().mockImplementation(() => new Promise((resolve) => {
      releaseUpload = resolve
    }))
    const { photo } = buildComposable(sendRequest)

    const firstAnalysis = photo.analyse(photoFile)
    await photo.analyse(photoFile)
    releaseUpload(outcomeWith({}))
    await firstAnalysis

    expect(sendRequest).toHaveBeenCalledTimes(1)
  })
})
