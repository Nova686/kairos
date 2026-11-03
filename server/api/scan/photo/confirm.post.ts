import { z } from 'zod'
import { confirmPhotoIdentification } from '../../../domain/scan/identify-photo'
import { assertPhotoRecognitionEnabled } from '../../../domain/scan/photo-recognition-mode'

const photoConfirmationSchema = z.object({
  uploadFingerprint: z.string().min(1).max(128),
  productId: z.uuid(),
})

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  assertPhotoRecognitionEnabled(useRuntimeConfig().photoRecognition)
  await confirmPhotoIdentification(await useDatabase(), await readBodyOr422(event, photoConfirmationSchema))
  return { confirmed: true }
})
