import type { KairosDatabase } from '../../database/open-database.ts'
import type { CatalogueImageEmbeddingDependencies, CatalogueImageEmbeddingSummary } from './embed-catalogue-images.ts'
import type { ImageEmbedder } from './image-embedder.ts'
import { isPhotoRecognitionEnabled } from './photo-recognition-mode.ts'

export type CatalogueImageEmbeddingTaskDependencies = {
  createEmbedder: () => ImageEmbedder
  openDatabase: () => Promise<KairosDatabase>
  embedCatalogueImages: (
    database: KairosDatabase,
    dependencies: CatalogueImageEmbeddingDependencies,
  ) => Promise<CatalogueImageEmbeddingSummary>
  now: Date
}

export const embedCatalogueImagesWhenEnabled = async (
  photoRecognitionMode: string,
  dependencies: CatalogueImageEmbeddingTaskDependencies,
): Promise<CatalogueImageEmbeddingSummary> => {
  if (!isPhotoRecognitionEnabled(photoRecognitionMode)) {
    return { embeddedCount: 0, failedCount: 0 }
  }
  const database = await dependencies.openDatabase()
  return dependencies.embedCatalogueImages(database, {
    embedder: dependencies.createEmbedder(),
    now: dependencies.now,
  })
}
