import { describe, expect, it } from 'vitest'
import { describeSoldProducts } from '../../../app/utils/sale-list-view.ts'

describe('describeSoldProducts', () => {
  it('names each sold product once with its count when sold several times', () => {
    expect(describeSoldProducts(['Coffret Aquali', 'ETB Zygarde', 'ETB Zygarde'])).toBe('Coffret Aquali · 2 × ETB Zygarde')
  })

  it('names a single product alone', () => {
    expect(describeSoldProducts(['ETB Zygarde'])).toBe('ETB Zygarde')
  })
})
