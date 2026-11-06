import { createError } from 'h3'

export const assertPhotoReadable = async (photo: Buffer): Promise<void> => {
  const { RawImage } = await import('@huggingface/transformers')
  try {
    await RawImage.fromBlob(new Blob([new Uint8Array(photo)]))
  }
  catch (decodingFailure) {
    throw createError({
      statusCode: 415,
      statusMessage: 'Photo illisible, réessayez avec une autre photo.',
      cause: decodingFailure,
    })
  }
}
