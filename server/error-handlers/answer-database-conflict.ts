import { describeDatabaseConflict } from '../database/database-conflict'

const conflictStatusCode = 409

export default defineNitroErrorHandler(async (error, event, { defaultHandler }) => {
  const conflictMessage = describeDatabaseConflict(error)
  if (conflictMessage === null) {
    return
  }
  const conflictAnswer = await defaultHandler(
    createError({ statusCode: conflictStatusCode, statusMessage: conflictMessage }),
    event,
    { json: true },
  )
  setResponseHeaders(event, conflictAnswer.headers)
  setResponseStatus(event, conflictAnswer.status, conflictAnswer.statusText)
  return send(event, JSON.stringify(conflictAnswer.body))
})
