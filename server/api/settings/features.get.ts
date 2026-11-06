import { describeServerFeatures } from '../../domain/settings/describe-server-features'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  return describeServerFeatures(useRuntimeConfig().photoRecognition)
})
