import { identifyPsaCertificate } from '../../../domain/scan/identify-psa-certificate'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireSessionUser(event)
  return identifyPsaCertificate(await useDatabase(), sessionUser.id, getRouterParam(event, 'certificate') ?? '')
})
