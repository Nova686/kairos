import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const downloadCardmarketPriceGuide = vi.fn()

vi.mock('../../../src/price-sources/cardmarket/cardmarket-files.ts', () => ({
  pokemonGameId: 6,
  downloadCardmarketPriceGuide,
}))

const guideWithOneProduct = {
  version: 1,
  createdAt: '2026-11-02T03:00:00+0100',
  priceGuides: [{ idProduct: 42, avg: 50, low: 40, trend: 48, avg7: null, avg30: null }],
}

const loadGatewayModule = async () => {
  vi.resetModules()
  return import('../../../server/domain/prices/refresh-product-prices.ts')
}

describe('createPriceSourceGateway Cardmarket guide cache', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    downloadCardmarketPriceGuide.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('downloads the guide once for two gateways created the same Paris day', async () => {
    vi.setSystemTime(new Date('2026-11-02T08:00:00Z'))
    downloadCardmarketPriceGuide.mockResolvedValue(guideWithOneProduct)
    const { createPriceSourceGateway } = await loadGatewayModule()

    await createPriceSourceGateway().cardmarketAggregates()
    vi.setSystemTime(new Date('2026-11-02T22:30:00Z'))
    const aggregates = await createPriceSourceGateway().cardmarketAggregates()

    expect(downloadCardmarketPriceGuide).toHaveBeenCalledTimes(1)
    expect(aggregates.get(42)?.averageCents).toBe(5000)
  })

  it('shares one in-flight download between concurrent gateways', async () => {
    vi.setSystemTime(new Date('2026-11-02T08:00:00Z'))
    downloadCardmarketPriceGuide.mockResolvedValue(guideWithOneProduct)
    const { createPriceSourceGateway } = await loadGatewayModule()

    await Promise.all([
      createPriceSourceGateway().cardmarketAggregates(),
      createPriceSourceGateway().cardmarketAggregates(),
    ])

    expect(downloadCardmarketPriceGuide).toHaveBeenCalledTimes(1)
  })

  it('downloads again on the next Paris day', async () => {
    vi.setSystemTime(new Date('2026-11-02T08:00:00Z'))
    downloadCardmarketPriceGuide.mockResolvedValue(guideWithOneProduct)
    const { createPriceSourceGateway } = await loadGatewayModule()

    await createPriceSourceGateway().cardmarketAggregates()
    vi.setSystemTime(new Date('2026-11-02T23:30:00Z'))
    await createPriceSourceGateway().cardmarketAggregates()

    expect(downloadCardmarketPriceGuide).toHaveBeenCalledTimes(2)
  })

  it('does not cache a failed download', async () => {
    vi.setSystemTime(new Date('2026-11-02T08:00:00Z'))
    downloadCardmarketPriceGuide
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(guideWithOneProduct)
    const { createPriceSourceGateway } = await loadGatewayModule()

    await expect(createPriceSourceGateway().cardmarketAggregates()).rejects.toThrow('network down')
    const aggregates = await createPriceSourceGateway().cardmarketAggregates()

    expect(downloadCardmarketPriceGuide).toHaveBeenCalledTimes(2)
    expect(aggregates.get(42)?.averageCents).toBe(5000)
  })
})
