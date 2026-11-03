import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { brandPrimaryColor } from '../shared/theme/brand-colors.ts'

const publicDirectory = resolve(process.cwd(), 'public')
const iconsDirectory = resolve(publicDirectory, 'icons')
const maskableMarkScale = 0.8

const markSvg = readFileSync(resolve(iconsDirectory, 'kairos.svg'), 'utf8')

const renderMark = (size: number) => sharp(Buffer.from(markSvg), { density: (72 * size) / 512 }).resize(size, size).png()

const renderMaskable = async (size: number): Promise<Buffer> => {
  const markSize = Math.round(size * maskableMarkScale)
  const mark = await renderMark(markSize).toBuffer()
  return sharp({ create: { width: size, height: size, channels: 3, background: brandPrimaryColor } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer()
}

mkdirSync(iconsDirectory, { recursive: true })
await renderMark(192).toFile(resolve(iconsDirectory, 'kairos-192.png'))
await renderMark(512).toFile(resolve(iconsDirectory, 'kairos-512.png'))
await sharp(await renderMaskable(512)).toFile(resolve(iconsDirectory, 'kairos-maskable-512.png'))
await renderMark(180).toFile(resolve(publicDirectory, 'apple-touch-icon.png'))
console.log(`Wrote icons to ${publicDirectory}`)
