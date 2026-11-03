import { isPhotoRecognitionEnabled } from '../scan/photo-recognition-mode.ts'

export type ServerFeatures = { photoRecognition: boolean }

export const describeServerFeatures = (photoRecognitionMode: unknown): ServerFeatures => ({
  photoRecognition: isPhotoRecognitionEnabled(photoRecognitionMode),
})
