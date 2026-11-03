import { detectPhotoFormat } from '../../../server/domain/scan/detect-photo-format.ts'

describe('detectPhotoFormat', () => {
  it('recognises JPEG and PNG by their signature', () => {
    expect(detectPhotoFormat(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('jpeg')
    expect(detectPhotoFormat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toBe('png')
  })

  it('rejects HEIC, text and empty content', () => {
    const heicHeader = Uint8Array.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])
    expect(detectPhotoFormat(heicHeader)).toBeNull()
    expect(detectPhotoFormat(Buffer.from('not an image'))).toBeNull()
    expect(detectPhotoFormat(new Uint8Array())).toBeNull()
  })
})
