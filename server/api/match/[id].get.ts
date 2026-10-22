import type { MatchDetails } from '~/types'

const notFound = () => createError({ statusCode: 404, statusMessage: 'Матч не найден' })

export default cachedEventHandler(async (event): Promise<MatchDetails> => {
  const id = getRouterParam(event, 'id') ?? ''
  // Номер матча — только цифры: с другим адресом API-Football не спрашиваем
  if (!/^\d+$/.test(id)) throw notFound()

  // Сбой API-Football (кончился лимит, сеть) — это 502, а не «матч не найден»
  const fixture = await getMatchFixture(id).catch(() => {
    throw createError({ statusCode: 502, statusMessage: 'API-Football недоступен' })
  })
  if (!fixture) throw notFound()
  return toMatchDetails(fixture)
}, {
  maxAge: 60,
  getKey: event => `match-${getRouterParam(event, 'id')}`,
})
