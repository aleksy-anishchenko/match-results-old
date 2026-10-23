import type { MatchesResponse } from '~/types'

export default defineEventHandler(async (event): Promise<MatchesResponse> => {
  const query = getQuery(event)
  // Тур (?round=5) или диапазон дат (?dateFrom=…&dateTo=…): на главной выбирают что-то одно.
  // Ни того, ни другого — текущий тур: так главной не нужно ждать /api/rounds, чтобы его узнать
  const requestedRound = typeof query.round === 'string' && query.round ? query.round : null
  const hasDates = typeof query.dateFrom === 'string' && !!query.dateFrom

  const today = getMoscowDate(new Date())
  const dateFrom = String(query.dateFrom ?? today)
  const dateTo = String(query.dateTo ?? today)

  const league = await getCompetitionSeason(query.leagueId)
  if (!league) return { matches: [] }

  const schedule = await getSeasonMatches(league.competition.id, league.season)

  // Тур нужен и при выборе по датам: в заголовке дня на главной пишем «· 5 тур»
  const { roundByMatch } = getSeasonRounds(schedule, league.competition)
  const round = requestedRound ?? (hasDates ? null : getCurrentRound(schedule, roundByMatch, new Date()))

  // Расписание уже по времени начала
  const filtered = schedule.filter((match) => {
    if (round) return roundByMatch.get(match.id) === round
    const moscowDate = getMoscowDate(match.timestamp)
    return moscowDate >= dateFrom && moscowDate <= dateTo
  })

  return { matches: filtered.map(match => toMatch(match, roundByMatch.get(match.id) ?? null)) }
})
