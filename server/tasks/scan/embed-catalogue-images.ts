import { embedCatalogueImages } from '../../domain/scan/embed-catalogue-images'
import { embedCatalogueImagesWhenEnabled } from '../../domain/scan/embed-catalogue-images-when-enabled'
import { sharedClipImageEmbedder } from '../../domain/scan/image-embedder'

export default defineTask({
  meta: {
    name: 'scan:embed-catalogue-images',
    description: 'Embed the catalogue images that have no embedding yet',
  },
  async run() {
    const runtimeConfig = useRuntimeConfig()
    return {
      result: await embedCatalogueImagesWhenEnabled(runtimeConfig.photoRecognition, {
        createEmbedder: () => sharedClipImageEmbedder(runtimeConfig.modelsDirectory),
        openDatabase: () => useDatabase(),
        embedCatalogueImages,
        now: new Date(),
      }),
    }
  },
})
