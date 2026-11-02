import { dashboardOverview } from '../domain/dashboard/dashboard-overview'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return dashboardOverview(await useDatabase(), sessionUser.id, new Date())
})
