export type PhotoFormat = 'jpeg' | 'png'

const jpegSignature = [0xff, 0xd8, 0xff]
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

const startsWith = (content: Uint8Array, signature: number[]): boolean =>
  signature.every((byte, position) => content[position] === byte)

export const detectPhotoFormat = (content: Uint8Array): PhotoFormat | null => {
  if (startsWith(content, jpegSignature)) {
    return 'jpeg'
  }
  if (startsWith(content, pngSignature)) {
    return 'png'
  }
  return null
}
