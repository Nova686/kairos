import { embedCatalogueImages } from '../../domain/scan/embed-catalogue-images'
import { sharedClipImageEmbedder } from '../../domain/scan/image-embedder'

export default defineTask({
  meta: {
    name: 'scan:embed-catalogue-images',
    description: 'Embed the catalogue images that have no embedding yet',
  },
  async run() {
    const embedder = sharedClipImageEmbedder(useRuntimeConfig().modelsDirectory)
    return { result: await embedCatalogueImages(await useDatabase(), { embedder, now: new Date() }) }
  },
})
