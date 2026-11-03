import type { UnavailabilityKind, UnavailableSource } from '../../shared/prices/unavailable-source.ts'

const priceSourceLabels: Record<string, string> = {
  ebay: 'eBay',
  cardmarket: 'Cardmarket',
  tcgdex: 'TCGdex',
  pokemontcg: 'Pokémon TCG',
}

const unavailabilityLabels: Record<UnavailabilityKind, string> = {
  'missing-key': 'clé manquante',
  'blocked': 'bloqué',
  'error': 'erreur',
}

export const describeUnavailableSource = (unavailableSource: UnavailableSource): string =>
  `${priceSourceLabels[unavailableSource.source] ?? unavailableSource.source} indisponible : ${unavailabilityLabels[unavailableSource.kind] ?? unavailabilityLabels.error}`

export const describeRefreshOutcome = (unavailableSources: UnavailableSource[]): string =>
  unavailableSources.length === 0
    ? 'Prix relevés.'
    : `Prix relevés. ${unavailableSources.map(describeUnavailableSource).join(' ; ')}.`
