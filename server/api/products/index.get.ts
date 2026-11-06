import { asc } from 'drizzle-orm'
import { products } from '../../database/schema/index'

export default defineEventHandler(async (event) => {
  await requireSessionUser(event)
  return (await useDatabase()).select().from(products).orderBy(asc(products.name))
})
