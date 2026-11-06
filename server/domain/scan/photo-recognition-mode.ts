import { createError } from 'h3'
import type { BoxTextReader } from './box-text-reader.ts'
import type { ImageEmbedder } from './image-embedder.ts'

export const photoRecognitionDisabledMessage = 'reconnaissance photo désactivée sur ce serveur'

const disabledPhotoRecognitionValues = ['off', 'false', '0', 'no', 'non']

export const isPhotoRecognitionEnabled = (photoRecognitionMode: unknown): boolean =>
  !disabledPhotoRecognitionValues.includes(String(photoRecognitionMode).trim().toLowerCase())

export const assertPhotoRecognitionEnabled = (photoRecognitionMode: unknown): void => {
  if (!isPhotoRecognitionEnabled(photoRecognitionMode)) {
    throw createError({ statusCode: 503, statusMessage: photoRecognitionDisabledMessage })
  }
}

export type PhotoRecognitionEngineFactories = {
  createEmbedder: () => ImageEmbedder
  createTextReader: () => BoxTextReader
}

export const createPhotoRecognitionEngines = (
  photoRecognitionMode: unknown,
  factories: PhotoRecognitionEngineFactories,
): { embedder: ImageEmbedder, textReader: BoxTextReader } => {
  assertPhotoRecognitionEnabled(photoRecognitionMode)
  return { embedder: factories.createEmbedder(), textReader: factories.createTextReader() }
}
