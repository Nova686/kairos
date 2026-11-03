import { createError } from 'h3'
import type { BoxTextReader } from './box-text-reader.ts'
import type { ImageEmbedder } from './image-embedder.ts'

export const photoRecognitionDisabledMessage = 'reconnaissance photo désactivée sur ce serveur'

export const isPhotoRecognitionEnabled = (photoRecognitionMode: string): boolean => photoRecognitionMode !== 'off'

export const assertPhotoRecognitionEnabled = (photoRecognitionMode: string): void => {
  if (!isPhotoRecognitionEnabled(photoRecognitionMode)) {
    throw createError({ statusCode: 503, statusMessage: photoRecognitionDisabledMessage })
  }
}

export type PhotoRecognitionEngineFactories = {
  createEmbedder: () => ImageEmbedder
  createTextReader: () => BoxTextReader
}

export const createPhotoRecognitionEngines = (
  photoRecognitionMode: string,
  factories: PhotoRecognitionEngineFactories,
): { embedder: ImageEmbedder, textReader: BoxTextReader } => {
  assertPhotoRecognitionEnabled(photoRecognitionMode)
  return { embedder: factories.createEmbedder(), textReader: factories.createTextReader() }
}
