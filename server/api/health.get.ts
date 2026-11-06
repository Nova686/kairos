import { checkHealth, unreachableDatabaseHealthReport } from '../domain/health/check-health'

export default defineEventHandler(async (event) => {
  const database = await useDatabase().catch(() => null)
  const report = database ? await checkHealth(database) : unreachableDatabaseHealthReport()
  setResponseStatus(event, report.status === 'ok' ? 200 : 503)
  return report
})
