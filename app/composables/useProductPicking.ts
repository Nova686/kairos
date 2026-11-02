import type { ProductCandidate } from '~~/server/domain/catalogue/search-product-candidates'
import { productCategories, type ProductCategory } from '~~/shared/catalogue/product-category'
import type { ProductReference } from '~~/shared/catalogue/product-reference'

export const useProductPicking = (onProductPicked: (product: ProductReference) => void) => {
  const errorMessage = ref('')
  const isCreating = ref(false)
  const newProductName = ref('')
  const newProductCategory = ref<ProductCategory>(productCategories[0]!)

  const createProductFrom = async (productDraft: Record<string, unknown>): Promise<boolean> => {
    if (isCreating.value) {
      return false
    }
    isCreating.value = true
    errorMessage.value = ''
    try {
      const createdProduct = await $fetch<ProductReference>('/api/products', { method: 'POST', body: productDraft })
      onProductPicked({ id: createdProduct.id, name: createdProduct.name, category: createdProduct.category })
      return true
    }
    catch {
      errorMessage.value = 'Impossible de créer ce produit.'
      return false
    }
    finally {
      isCreating.value = false
    }
  }

  const pickCandidate = async (candidate: ProductCandidate): Promise<void> => {
    if (candidate.productId !== null) {
      onProductPicked({ id: candidate.productId, name: candidate.draft.name, category: candidate.draft.category })
      return
    }
    await createProductFrom({ ...candidate.draft })
  }

  const createBlankProduct = async (): Promise<void> => {
    if (newProductName.value.trim() === '') {
      return
    }
    if (await createProductFrom({ name: newProductName.value, category: newProductCategory.value })) {
      newProductName.value = ''
    }
  }

  return { errorMessage, isCreating, newProductName, newProductCategory, pickCandidate, createBlankProduct }
}
