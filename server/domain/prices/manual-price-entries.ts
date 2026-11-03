import { createError } from 'h3'
import { isConditionAllowed } from '../../../shared/catalogue/condition-scale.ts'
import { isProductCategory } from '../../../shared/catalogue/product-category.ts'
import type { ManualPriceDraft } from '../../../shared/prices/manual-price-draft-schema.ts'
import type { KairosDatabase } from '../../database/open-database.ts'
import { priceSnapshotListings, priceSnapshots } from '../../database/schema/index.ts'
import { findProductOr404 } from '../catalogue/catalogue-service.ts'
import { parisCalendarDateOf, parisNoonOf } from './start-of-paris-day.ts'
import { canonicalCompanyName } from '../../../shared/prices/grading-company.ts'

const manualListingTitle = 'Relevé manuel'

const unprocessable = (statusMessage: string) => createError({ statusCode: 422, statusMessage })

export const recordManualPrice = async (
  database: KairosDatabase,
  userId: string,
  productId: string,
  draft: ManualPriceDraft,
  now: Date = new Date(),
): Promise<string> => {
  const product = await findProductOr404(database, productId)
  if (!isProductCategory(product.category) || !isConditionAllowed(product.category, draft.kairosCondition)) {
    throw unprocessable('État non autorisé pour cette catégorie')
  }
  if (draft.observedOn > parisCalendarDateOf(now)) {
    throw unprocessable('Date d\'observation dans le futur')
  }
  const isGradedCard = product.category === 'graded-card'
  if (isGradedCard && (!draft.gradingCompany || !draft.grade)) {
    throw unprocessable('Société de gradation et note obligatoires pour une carte gradée')
  }
  return database.transaction(async (transaction) => {
    const [snapshot] = await transaction
      .insert(priceSnapshots)
      .values({
        productId,
        source: draft.source,
        kind: 'manual',
        sourceCondition: null,
        kairosCondition: draft.kairosCondition,
        gradingCompany: isGradedCard ? canonicalCompanyName(draft.gradingCompany!) : null,
        grade: isGradedCard ? draft.grade! : null,
        observedAt: parisNoonOf(draft.observedOn),
        averageCents: draft.priceCents,
        medianCents: draft.priceCents,
        lowCents: draft.priceCents,
        listingCount: 1,
        createdByUserId: userId,
      })
      .returning({ id: priceSnapshots.id })
    if (draft.url) {
      await transaction.insert(priceSnapshotListings).values({
        snapshotId: snapshot!.id,
        title: manualListingTitle,
        priceCents: draft.priceCents,
        url: draft.url,
      })
    }
    return snapshot!.id
  })
}
