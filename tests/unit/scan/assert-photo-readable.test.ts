import { readFile } from 'node:fs/promises'
import { assertPhotoReadable } from '../../../server/domain/scan/assert-photo-readable.ts'

describe('assertPhotoReadable', () => {
  it('accepts a real photo', async () => {
    const photo = await readFile(new URL('../../fixtures/scan/etb-box.jpg', import.meta.url))

    await expect(assertPhotoReadable(photo)).resolves.toBeUndefined()
  })

  it('answers 415 with a French message for a JPEG header followed by garbage', async () => {
    const corruptPhoto = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.from('garbage-not-a-jpeg-at-all')])

    await expect(assertPhotoReadable(corruptPhoto)).rejects.toMatchObject({
      statusCode: 415,
      statusMessage: 'Photo illisible, réessayez avec une autre photo.',
    })
  })
})
