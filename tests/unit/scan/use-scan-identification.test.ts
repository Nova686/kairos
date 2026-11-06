import { useScanIdentification } from '../../../app/composables/useScanIdentification.ts'

const kinderProduct = { id: 'product-1', name: 'Kinder Bueno', category: 'other' as const }

const candidateFor = (label: string) => ({
  origin: 'identification' as const,
  label,
  imageUrl: null,
  productId: null,
  draft: { name: label, category: 'other' as const },
})

describe('useScanIdentification', () => {
  it('goes straight to the known product without a picker', async () => {
    const sendRequest = vi.fn().mockResolvedValue({
      barcode: '3017620422003',
      knownProduct: kinderProduct,
      candidates: [],
      unavailableSources: [],
    })
    const onProductReady = vi.fn()
    const scan = useScanIdentification(onProductReady, sendRequest)

    await scan.identify('3017620422003')

    expect(sendRequest).toHaveBeenCalledWith('/api/scan/barcode/3017620422003')
    expect(onProductReady).toHaveBeenCalledWith(kinderProduct, null)
    expect(scan.pendingBarcode.value).toBeNull()
  })

  it('does not call the API for an invalid barcode', async () => {
    const sendRequest = vi.fn()
    const scan = useScanIdentification(vi.fn(), sendRequest)

    await scan.identify('3017620422004')

    expect(sendRequest).not.toHaveBeenCalled()
    expect(scan.errorMessage.value).toBe('Code-barres invalide.')
  })

  it('keeps the barcode pending for candidates and links it after a pick', async () => {
    const sendRequest = vi.fn()
      .mockResolvedValueOnce({
        barcode: '3017620422003',
        knownProduct: null,
        candidates: [candidateFor('Nutella')],
        unavailableSources: ['upcitemdb'],
      })
      .mockResolvedValueOnce({ linked: true })
    const onProductReady = vi.fn()
    const scan = useScanIdentification(onProductReady, sendRequest)

    await scan.identify('3017620422003')
    expect(scan.identifiedCandidates.value).toHaveLength(1)
    expect(scan.pendingBarcode.value).toBe('3017620422003')

    await scan.pickProduct(kinderProduct)

    expect(sendRequest).toHaveBeenLastCalledWith('/api/scan/barcode/3017620422003/link', {
      method: 'POST',
      body: { productId: 'product-1' },
    })
    expect(scan.noticeMessage.value).toBe('Code-barres associé.')
    expect(onProductReady).toHaveBeenCalledWith(kinderProduct, null)
  })

  it('flags an unknown code only when the barcode has neither a known product nor candidates', async () => {
    const sendRequest = vi.fn()
      .mockResolvedValueOnce({ barcode: '3017620422003', knownProduct: null, candidates: [], unavailableSources: ['upcitemdb'] })
      .mockResolvedValueOnce({ barcode: '3017620422003', knownProduct: null, candidates: [candidateFor('Nutella')], unavailableSources: [] })
    const scan = useScanIdentification(vi.fn(), sendRequest)
    expect(scan.isUnknownCode.value).toBe(false)

    await scan.identify('3017620422003')
    expect(scan.isUnknownCode.value).toBe(true)

    await scan.identify('3017620422003')
    expect(scan.isUnknownCode.value).toBe(false)
  })

  it('still hands over the product when linking fails and says so', async () => {
    const sendRequest = vi.fn()
      .mockResolvedValueOnce({ barcode: '3017620422003', knownProduct: null, candidates: [], unavailableSources: [] })
      .mockRejectedValueOnce({ data: { statusMessage: 'Introuvable' } })
    const onProductReady = vi.fn()
    const scan = useScanIdentification(onProductReady, sendRequest)
    await scan.identify('3017620422003')

    await scan.pickProduct(kinderProduct)

    expect(scan.errorMessage.value).toContain('Introuvable')
    expect(scan.pendingBarcode.value).toBe('3017620422003')
    expect(onProductReady).toHaveBeenCalledOnce()
  })

  it('sends certificate numbers to PSA in PSA mode and prefills the grading fields', async () => {
    const prefilledStockItem = { condition: 'graded', gradingCompany: 'PSA', grade: '10', certificateNumber: '12345678' }
    const sendRequest = vi.fn().mockResolvedValue({
      identification: null,
      candidates: [candidateFor('Dracaufeu')],
      prefilledStockItem,
      unavailableSources: [],
    })
    const onProductReady = vi.fn()
    const scan = useScanIdentification(onProductReady, sendRequest)
    scan.isPsaMode.value = true

    await scan.identify('12345678')
    await scan.pickProduct(kinderProduct)

    expect(sendRequest).toHaveBeenCalledWith('/api/scan/psa/12345678')
    expect(onProductReady).toHaveBeenCalledWith(kinderProduct, prefilledStockItem)
  })

  it('ignores an older in-flight response once an invalid code was entered', async () => {
    let releaseResponse: (value: unknown) => void = () => {}
    const sendRequest = vi.fn().mockReturnValue(new Promise((resolve) => {
      releaseResponse = resolve
    }))
    const scan = useScanIdentification(vi.fn(), sendRequest)

    const firstIdentification = scan.identify('3017620422003')
    await scan.identify('3017620422004')
    releaseResponse({
      barcode: '3017620422003',
      knownProduct: null,
      candidates: [candidateFor('Nutella')],
      unavailableSources: [],
    })
    await firstIdentification

    expect(scan.identifiedCandidates.value).toEqual([])
    expect(scan.pendingBarcode.value).toBeNull()
    expect(scan.isIdentifying.value).toBe(false)
  })

  it('applies the PSA prefill once only', async () => {
    const prefilledStockItem = { condition: 'graded', gradingCompany: 'PSA', grade: '10', certificateNumber: '12345678' }
    const sendRequest = vi.fn().mockResolvedValue({
      identification: null,
      candidates: [],
      prefilledStockItem,
      unavailableSources: [],
    })
    const onProductReady = vi.fn()
    const scan = useScanIdentification(onProductReady, sendRequest)
    scan.isPsaMode.value = true
    await scan.identify('12345678')

    await scan.pickProduct(kinderProduct)
    await scan.pickProduct(kinderProduct)

    expect(onProductReady).toHaveBeenNthCalledWith(1, kinderProduct, prefilledStockItem)
    expect(onProductReady).toHaveBeenNthCalledWith(2, kinderProduct, null)
  })

  it('shows the server message when the certificate is already owned', async () => {
    const sendRequest = vi.fn().mockRejectedValue({ data: { statusMessage: 'Certificat déjà possédé' } })
    const scan = useScanIdentification(vi.fn(), sendRequest)
    scan.isPsaMode.value = true

    await scan.identify('12345678')

    expect(scan.errorMessage.value).toBe('Certificat déjà possédé')
    expect(scan.isIdentifying.value).toBe(false)
  })
})
