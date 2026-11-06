import { conditionCodesFor, conditionLabel, type ConditionCode } from '~~/shared/catalogue/condition-scale'
import { productCategories, productCategoryLabels, type ProductCategory } from '~~/shared/catalogue/product-category'

interface ConditionMappingRow {
  category: ProductCategory
  source: string
  sourceCondition: string
  kairosCondition: ConditionCode
}

interface TitleRuleRow {
  id: string
  category: ProductCategory
  keywords: string[]
  kairosCondition: ConditionCode
  priority: number
}

interface ConditionMappingsResponse {
  mappings: ConditionMappingRow[]
  rules: TitleRuleRow[]
}

export const useConditionMappingsPage = () => {
  const { data: fetchedMappings, refresh, pending } = useFetch<ConditionMappingsResponse>('/api/condition-mappings', {
    default: () => ({ mappings: [], rules: [] }),
  })
  const mappings = computed(() => fetchedMappings.value?.mappings ?? [])
  const rules = computed(() => fetchedMappings.value?.rules ?? [])
  const errorMessage = ref('')
  const newMapping = reactive({
    category: 'pokemon-sealed' as ProductCategory,
    source: 'ebay',
    sourceCondition: '',
    kairosCondition: 'sealed-new' as ConditionCode,
  })
  const newRule = reactive({
    category: 'pokemon-sealed' as ProductCategory,
    keywords: [] as string[],
    kairosCondition: 'opened-incomplete' as ConditionCode,
    priority: 10,
  })
  const editedRule = ref<TitleRuleRow | null>(null)

  watch(() => newMapping.category, (category) => {
    newMapping.kairosCondition = conditionKeptInCategory(category, newMapping.kairosCondition)
  })
  watch(() => newRule.category, (category) => {
    newRule.kairosCondition = conditionKeptInCategory(category, newRule.kairosCondition)
  })

  const sendRequest = $fetch as (path: string, options: { method: string, body?: unknown, query?: unknown }) => Promise<unknown>

  const categoryOptions = productCategories.map(category => ({ value: category, title: productCategoryLabels[category] }))

  const conditionOptionsFor = (category: ProductCategory) =>
    conditionCodesFor(category).map(code => ({ value: code, title: conditionLabel(code) }))

  const categoryLabel = (category: ProductCategory): string => productCategoryLabels[category]

  const kairosConditionLabel = (condition: ConditionCode): string => conditionLabel(condition)

  const runMutation = async (mutation: () => Promise<unknown>): Promise<boolean> => {
    errorMessage.value = ''
    try {
      await mutation()
      await refresh()
      return true
    }
    catch (failure) {
      errorMessage.value = describeRequestFailure(failure)
      return false
    }
  }

  const saveMapping = (mapping: ConditionMappingRow) =>
    runMutation(() => sendRequest('/api/condition-mappings', { method: 'PUT', body: mapping }))

  const addMapping = async () => {
    const wasSaved = await saveMapping({ ...newMapping, sourceCondition: newMapping.sourceCondition.trim() })
    if (wasSaved) {
      newMapping.sourceCondition = ''
    }
  }

  const changeMappingCondition = (mapping: ConditionMappingRow, kairosCondition: ConditionCode) =>
    saveMapping({ ...mapping, kairosCondition })

  const deleteMapping = (mapping: ConditionMappingRow) =>
    runMutation(() => sendRequest('/api/condition-mappings', {
      method: 'DELETE',
      query: { category: mapping.category, source: mapping.source, sourceCondition: mapping.sourceCondition },
    }))

  const addRule = async () => {
    const wasCreated = await runMutation(() =>
      sendRequest('/api/condition-mappings/title-rules', { method: 'POST', body: { ...newRule } }))
    if (wasCreated) {
      newRule.keywords = []
    }
  }

  const startEditingRule = (rule: TitleRuleRow) => {
    editedRule.value = { ...rule }
  }

  const cancelEditingRule = () => {
    editedRule.value = null
  }

  const saveEditedRule = async () => {
    if (!editedRule.value) {
      return
    }
    const { id, ...ruleFields } = editedRule.value
    if (await runMutation(() => sendRequest(`/api/condition-mappings/title-rules/${id}`, { method: 'PATCH', body: ruleFields }))) {
      editedRule.value = null
    }
  }

  const deleteRule = (rule: TitleRuleRow) =>
    runMutation(() => sendRequest(`/api/condition-mappings/title-rules/${rule.id}`, { method: 'DELETE' }))

  return {
    mappings,
    rules,
    pending,
    errorMessage,
    newMapping,
    newRule,
    editedRule,
    categoryOptions,
    conditionOptionsFor,
    categoryLabel,
    kairosConditionLabel,
    addMapping,
    changeMappingCondition,
    deleteMapping,
    addRule,
    startEditingRule,
    cancelEditingRule,
    saveEditedRule,
    deleteRule,
  }
}
