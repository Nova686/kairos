import type { ConditionCode } from '../catalogue/condition-scale.ts'
import { conditionCodesFor } from '../catalogue/condition-scale.ts'
import type { ProductCategory } from '../catalogue/product-category.ts'
import { medianCents } from './median.ts'

export type ValuationSnapshot = {
  source: string
  kind: string
  kairosCondition: ConditionCode | null
  gradingCompany: string | null
  grade: string | null
  observedAt: Date
  figureCents: number | null
}

export type StockItemValuation = {
  valueCents: number | null
  approximate: boolean
  usedCondition: string | null
  perSource: { source: string; figureCents: number; observedAt: Date }[]
}

type ValuedStockItem = {
  category: ProductCategory
  condition: ConditionCode
  gradingCompany: string | null
  grade: string | null
}

type SourceFigure = { source: string; figureCents: number; observedAt: Date }

type ConditionPosition = { key: string; position: number; label: string }

type SnapshotGroup = {
  source: string
  isManual: boolean
  conditionPosition: ConditionPosition
  snapshots: ValuationSnapshot[]
}

const valuationSources = ['ebay', 'cardmarket', 'vinted', 'leboncoin']
const freshnessWindowMilliseconds = 7 * 24 * 60 * 60 * 1000
const aggregateKind = 'source-aggregate'
const manualKind = 'manual'
const aggregateCondition: ConditionCode = 'sealed-new'

const newestDate = (dates: Date[]): Date => new Date(Math.max(...dates.map(date => date.getTime())))

const locateCondition = (
  stockItem: ValuedStockItem,
  snapshot: ValuationSnapshot,
): ConditionPosition | null => {
  if (stockItem.category === 'graded-card') {
    if (snapshot.kind === aggregateKind || snapshot.kairosCondition !== 'graded') return null
    if (snapshot.gradingCompany !== stockItem.gradingCompany || snapshot.grade === null) return null
    const gradeNumber = Number(snapshot.grade)
    if (Number.isNaN(gradeNumber)) return null
    return { key: String(gradeNumber), position: gradeNumber, label: `${snapshot.gradingCompany} ${snapshot.grade}` }
  }
  const condition = snapshot.kind === aggregateKind
    ? (stockItem.category === 'pokemon-sealed' ? aggregateCondition : null)
    : snapshot.kairosCondition
  if (condition === null) return null
  const position = conditionCodesFor(stockItem.category).indexOf(condition)
  if (position === -1) return null
  return { key: condition, position, label: condition }
}

const groupFreshSnapshots = (stockItem: ValuedStockItem, snapshots: ValuationSnapshot[], now: Date): SnapshotGroup[] => {
  const groups = new Map<string, SnapshotGroup>()
  for (const snapshot of snapshots) {
    if (snapshot.figureCents === null || !valuationSources.includes(snapshot.source)) continue
    if (now.getTime() - snapshot.observedAt.getTime() > freshnessWindowMilliseconds) continue
    const conditionPosition = locateCondition(stockItem, snapshot)
    if (conditionPosition === null) continue
    const isManual = snapshot.kind === manualKind
    const groupKey = [snapshot.source, isManual, conditionPosition.key].join('|')
    const group = groups.get(groupKey) ?? { source: snapshot.source, isManual, conditionPosition, snapshots: [] }
    group.snapshots.push(snapshot)
    groups.set(groupKey, group)
  }
  return [...groups.values()]
}

const figureOfGroup = (group: SnapshotGroup): SourceFigure => {
  const observedAt = newestDate(group.snapshots.map(snapshot => snapshot.observedAt))
  if (group.isManual) {
    return { source: group.source, figureCents: medianCents(group.snapshots.map(snapshot => snapshot.figureCents!))!, observedAt }
  }
  const newestSnapshot = group.snapshots.reduce((newest, snapshot) => snapshot.observedAt > newest.observedAt ? snapshot : newest)
  return { source: group.source, figureCents: newestSnapshot.figureCents!, observedAt }
}

const targetPositionOf = (stockItem: ValuedStockItem): number =>
  stockItem.category === 'graded-card'
    ? Number(stockItem.grade)
    : conditionCodesFor(stockItem.category).indexOf(stockItem.condition)

const pickClosestPosition = (stockItem: ValuedStockItem, groups: SnapshotGroup[]): ConditionPosition | null => {
  const targetPosition = targetPositionOf(stockItem)
  const preferHigherPosition = stockItem.category !== 'graded-card'
  const candidates = groups.map(group => group.conditionPosition)
  if (candidates.length === 0) return null
  return candidates.reduce((best, candidate) => {
    const distanceGap = Math.abs(candidate.position - targetPosition) - Math.abs(best.position - targetPosition)
    if (distanceGap !== 0) return distanceGap < 0 ? candidate : best
    const candidateIsHigher = candidate.position > best.position
    return candidateIsHigher === preferHigherPosition ? candidate : best
  })
}

export const estimateStockItemValue = (
  stockItem: ValuedStockItem,
  snapshots: ValuationSnapshot[],
  now: Date,
): StockItemValuation => {
  const groups = groupFreshSnapshots(stockItem, snapshots, now)
  const usedPosition = pickClosestPosition(stockItem, groups)
  if (usedPosition === null) return { valueCents: null, approximate: false, usedCondition: null, perSource: [] }
  const figuresBySource = new Map<string, SourceFigure[]>()
  for (const group of groups.filter(candidate => candidate.conditionPosition.key === usedPosition.key)) {
    figuresBySource.set(group.source, [...(figuresBySource.get(group.source) ?? []), figureOfGroup(group)])
  }
  const perSource = [...figuresBySource.entries()].map(([source, figures]) => ({
    source,
    figureCents: medianCents(figures.map(figure => figure.figureCents))!,
    observedAt: newestDate(figures.map(figure => figure.observedAt)),
  }))
  return {
    valueCents: medianCents(perSource.map(entry => entry.figureCents)),
    approximate: usedPosition.position !== targetPositionOf(stockItem),
    usedCondition: usedPosition.label,
    perSource,
  }
}
