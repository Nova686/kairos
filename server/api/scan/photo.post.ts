import { identifyPhoto } from '../../domain/scan/identify-photo'
import { sharedTesseractBoxTextReader } from '../../domain/scan/box-text-reader'
import { sharedClipImageEmbedder } from '../../domain/scan/image-embedder'
import { searchProductCandidates } from '../../domain/catalogue/search-product-candidates'
import { detectPhotoFormat } from '../../domain/scan/detect-photo-format'

const maximumPhotoBytes = 5 * 1024 * 1024
const multipartOverheadBytes = 64 * 1024

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  const declaredLength = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (declaredLength > maximumPhotoBytes + multipartOverheadBytes) {
    throw createError({ statusCode: 413, statusMessage: 'Photo trop lourde : 5 Mo maximum.' })
  }
  const formParts = await readMultipartFormData(event)
  const photoPart = formParts?.find(part => part.name === 'photo')
  if (!photoPart) {
    throw createError({ statusCode: 422, statusMessage: 'Photo manquante.' })
  }
  if (photoPart.data.length > maximumPhotoBytes) {
    throw createError({ statusCode: 413, statusMessage: 'Photo trop lourde : 5 Mo maximum.' })
  }
  if (detectPhotoFormat(photoPart.data) === null) {
    throw createError({ statusCode: 415, statusMessage: 'Format non pris en charge : envoyez une photo JPEG ou PNG.' })
  }
  const database = await useDatabase()
  const runtimeConfig = useRuntimeConfig()
  return identifyPhoto(database, photoPart.data, {
    embedder: sharedClipImageEmbedder(runtimeConfig.modelsDirectory),
    textReader: sharedTesseractBoxTextReader(runtimeConfig.tesseractDirectory),
    searchCandidates: query => searchProductCandidates(database, query),
  })
})
