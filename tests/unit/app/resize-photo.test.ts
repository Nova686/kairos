import { computeTargetDimensions } from '../../../app/utils/resize-photo.ts'

describe('computeTargetDimensions', () => {
  it('scales a landscape photo so that its width is 1024', () => {
    expect(computeTargetDimensions(4032, 3024)).toEqual({ width: 1024, height: 768 })
  })

  it('scales a portrait photo so that its height is 1024', () => {
    expect(computeTargetDimensions(3024, 4032)).toEqual({ width: 768, height: 1024 })
  })

  it('never enlarges a photo that already fits', () => {
    expect(computeTargetDimensions(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('keeps at least one pixel on the short side of an extreme panorama', () => {
    expect(computeTargetDimensions(20000, 10)).toEqual({ width: 1024, height: 1 })
  })
})
