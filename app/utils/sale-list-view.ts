export const describeSoldProducts = (productNames: string[]): string => {
  const soldCountByProductName = new Map<string, number>()
  for (const productName of productNames) {
    soldCountByProductName.set(productName, (soldCountByProductName.get(productName) ?? 0) + 1)
  }
  return [...soldCountByProductName]
    .map(([productName, soldCount]) => (soldCount > 1 ? `${soldCount} × ${productName}` : productName))
    .join(' · ')
}
