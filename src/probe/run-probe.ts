import { mkdirSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { lookupOpenBeautyFacts } from '../identification-sources/open-beauty-facts.ts'
import { lookupPsaCertificate } from '../identification-sources/psa-certificate.ts'
import { lookupUpcitemdb } from '../identification-sources/upcitemdb.ts'
import { downloadCardmarketPriceGuide, pokemonGameId } from '../price-sources/cardmarket/cardmarket-files.ts'
import { parseCardmarketPriceGuide } from '../price-sources/cardmarket/parse-cardmarket-price-guide.ts'
import { searchEbayListings } from '../price-sources/ebay/ebay-adapter.ts'
import { fetchPokemontcgCardAggregate, searchPokemontcgCards } from '../price-sources/pokemontcg/pokemontcg-adapter.ts'
import { SourceDisabledError } from '../price-sources/price-source-types.ts'
import { readRequiredSetting } from '../source-http/request-source-json.ts'
import type { SourceId } from '../price-sources/price-source-types.ts'
import { fetchTcgdexCardAggregate, searchTcgdexCards } from '../price-sources/tcgdex/tcgdex-adapter.ts'
import { probeReferences } from './probe-references.ts'
import { describeProbeFailure, keepProbeSample, summarizeProbe } from './summarize-probe.ts'
import type { ProbeOutcome } from './summarize-probe.ts'

const probeLabel = parseArgs({ options: { label: { type: 'string', default: 'local' } } }).values.label ?? 'local'
const probeOutcomes: ProbeOutcome[] = []

const probeSource = async (source: SourceId, reference: string, runProbe: () => Promise<unknown[]>): Promise<void> => {
  const startedAt = Date.now()
  try {
    const probeResults = await runProbe()
    probeOutcomes.push({ source, reference, status: 'ok', reason: null, resultCount: probeResults.length, durationMs: Date.now() - startedAt, sample: keepProbeSample(probeResults) })
  } catch (failure) {
    const { status, reason } = describeProbeFailure(failure)
    probeOutcomes.push({ source, reference, status, reason, resultCount: 0, durationMs: Date.now() - startedAt, sample: [] })
  }
}

const presentOnly = <T>(foundValue: T | null): T[] => (foundValue === null ? [] : [foundValue])

for (const ebayQuery of probeReferences.ebayQueries) {
  await probeSource('ebay', ebayQuery, () => searchEbayListings(ebayQuery))
}

await probeSource('cardmarket', `price guide ${probeReferences.cardmarketProductIds.join(', ')}`, async () => {
  const aggregatesByProduct = parseCardmarketPriceGuide(await downloadCardmarketPriceGuide(pokemonGameId), new Date().toISOString())
  return probeReferences.cardmarketProductIds.flatMap((productId) => presentOnly(aggregatesByProduct.get(productId) ?? null))
})

await probeSource('tcgdex', probeReferences.tcgdexFrenchName, () => searchTcgdexCards(probeReferences.tcgdexFrenchName))
await probeSource('tcgdex', probeReferences.tcgdexCardId, async () => presentOnly(await fetchTcgdexCardAggregate(probeReferences.tcgdexCardId)))

await probeSource('pokemontcg', probeReferences.pokemontcgName, async () => {
  const cardCandidates = await searchPokemontcgCards(probeReferences.pokemontcgName)
  const firstCandidate = cardCandidates[0]
  return firstCandidate ? presentOnly(await fetchPokemontcgCardAggregate(firstCandidate.sourceCardId)) : []
})

await probeSource('upcitemdb', probeReferences.upcitemdbBarcode, async () => presentOnly(await lookupUpcitemdb(probeReferences.upcitemdbBarcode)))
await probeSource('openbeautyfacts', probeReferences.openBeautyFactsBarcode, async () => presentOnly(await lookupOpenBeautyFacts(probeReferences.openBeautyFactsBarcode)))

await probeSource('psa', 'certificate', async () => {
  readRequiredSetting('psa', 'PSA_API_TOKEN')
  const certificateNumber = process.env[probeReferences.psaCertificateSetting]
  if (!certificateNumber) {
    throw new SourceDisabledError('psa', probeReferences.psaCertificateSetting)
  }
  return presentOnly(await lookupPsaCertificate(certificateNumber))
})

const probeSummary = summarizeProbe(probeOutcomes)
const reportPath = `probe-reports/${probeLabel}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
mkdirSync('probe-reports', { recursive: true })
writeFileSync(reportPath, JSON.stringify({ label: probeLabel, nodeVersion: process.version, summary: probeSummary, outcomes: probeOutcomes }, null, 2))
console.table(probeOutcomes.map(({ source, reference, status, reason, resultCount, durationMs }) => ({ source, reference, status, reason, resultCount, durationMs })))
console.log(reportPath)
