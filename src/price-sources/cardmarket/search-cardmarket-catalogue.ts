export interface CardmarketCatalogueProduct {
  idProduct: number
  name: string
  categoryName: string
  idExpansion: number
}

const toSearchableText = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const searchCardmarketCatalogue = (
  products: CardmarketCatalogueProduct[],
  query: string,
  limit: number,
): CardmarketCatalogueProduct[] => {
  const queryWords = toSearchableText(query).split(/\s+/).filter((queryWord) => queryWord.length > 0)
  if (queryWords.length === 0) {
    return []
  }
  return products
    .filter((product) => {
      const searchableName = toSearchableText(product.name)
      return queryWords.every((queryWord) => searchableName.includes(queryWord))
    })
    .sort((firstProduct, secondProduct) => firstProduct.name.length - secondProduct.name.length)
    .slice(0, limit)
}
