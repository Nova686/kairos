import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const outputPath = resolve(process.cwd(), 'tests/fixtures/scan/etb-box.jpg')

const boxArtwork = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="boxFace" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2b6cb0"/>
      <stop offset="1" stop-color="#6b46c1"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="#e2e8f0"/>
  <rect x="100" y="120" width="600" height="560" rx="24" fill="url(#boxFace)"/>
  <rect x="100" y="120" width="600" height="90" rx="24" fill="#1a365d"/>
  <circle cx="400" cy="400" r="110" fill="#fefcbf" opacity="0.85"/>
  <text x="400" y="190" font-family="DejaVu Sans, Arial, sans-serif" font-size="44" font-weight="bold" fill="#ffffff" text-anchor="middle">Évolutions Prismatiques</text>
  <text x="400" y="580" font-family="DejaVu Sans, Arial, sans-serif" font-size="40" fill="#ffffff" text-anchor="middle">Coffret Dresseur d'Élite</text>
</svg>
`

mkdirSync(dirname(outputPath), { recursive: true })
await sharp(Buffer.from(boxArtwork)).jpeg({ quality: 85 }).toFile(outputPath)
console.log(`Wrote ${outputPath}`)
