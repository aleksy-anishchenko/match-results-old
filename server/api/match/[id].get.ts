import type { MatchDetails } from '~/types'

// statusMessage — для строки статуса HTTP, там только латиница; текст по-русски — в message
const notFound = () => createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Матч не найден' })

export default defineEventHandler(async (event): Promise<MatchDetails> => {
  const id = getRouterParam(event, 'id') ?? ''
  // Номер матча — только цифры: с другим адресом API-Football не спрашиваем
  if (!/^\d+$/.test(id)) throw notFound()

  // Сбой API-Football (кончился лимит, сеть) — это 502, а не «матч не найден»
  const fixture = await getMatchFixture(id).catch(() => {
    throw createError({ statusCode: 502, statusMessage: 'Bad Gateway', message: 'API-Football недоступен' })
  })
  if (!fixture) throw notFound()
  return toMatchDetails(fixture)
})
