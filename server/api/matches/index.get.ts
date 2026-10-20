import type { Match } from '~/types'

type ApiMatch = {
  idEvent: string
  strHomeTeam: string
  strAwayTeam: string
  strHomeTeamBadge: string
  strAwayTeamBadge: string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string
  strTimestamp: string
  intRound: string
  dateEvent: string
  strGroup: string | null
  strSeason: string
}

export default cachedEventHandler(async (event) => {
  const query = getQuery(event)
  const leagueId = String(query.leagueId ?? DEFAULT_COMPETITION_ID)
  const competition = getCompetition(leagueId)
  // Тур (?round=5) или диапазон дат (?dateFrom=…&dateTo=…): на главной выбирают что-то одно.
  // Ни того, ни другого — текущий тур: так главной не нужно ждать /api/rounds, чтобы его узнать
  const requestedRound = typeof query.round === 'string' && query.round ? query.round : null
  const hasDates = typeof query.dateFrom === 'string' && !!query.dateFrom

  const today = getMoscowDate(new Date())
  const dateFrom = String(query.dateFrom ?? today)
  const dateTo = String(query.dateTo ?? today)

  const season = await getCurrentSeason(leagueId)
  if (!season) return { matches: [] }

  const schedule = await getSeasonSchedule<ApiMatch>(leagueId, season)

  // Тур нужен и при выборе по датам: в заголовке дня на главной пишем «· 5 тур»
  const roundByMatch = competition ? getSeasonRounds(schedule, competition).roundByMatch : null
  // Без туров (сезона нет в API) текущего тура нет — тогда матчи за сегодня
  const round = requestedRound
    ?? (hasDates || !roundByMatch ? null : getCurrentRound(schedule, roundByMatch, new Date()))

  const filtered = schedule
    .filter((match) => {
      if (round) return roundByMatch?.get(match.idEvent) === round
      const moscowDate = getMoscowDate(match.strTimestamp)
      return moscowDate >= dateFrom && moscowDate <= dateTo
    })
    .sort((a, b) => a.strTimestamp.localeCompare(b.strTimestamp))

  const penScoreMap = await getPenaltyScores(filtered)

  const matches: Match[] = filtered.map(match => ({
    idEvent: match.idEvent,
    homeTeam: match.strHomeTeam,
    awayTeam: match.strAwayTeam,
    homeBadge: match.strHomeTeamBadge,
    awayBadge: match.strAwayTeamBadge,
    homeScore: match.intHomeScore,
    awayScore: match.intAwayScore,
    homePenScore: penScoreMap[match.idEvent]?.home ?? null,
    awayPenScore: penScoreMap[match.idEvent]?.away ?? null,
    status: match.strStatus,
    // Минуты в расписании нет: её и свежий счёт подставляет страница из /api/live (useLiveScores)
    progress: null,
    timestamp: match.strTimestamp,
    date: match.dateEvent,
    group: match.strGroup,
    season: match.strSeason,
    round: roundByMatch?.get(match.idEvent) ?? null,
  }))

  return { matches }
}, {
  maxAge: 60,
  getKey: (event) => {
    const query = getQuery(event)
    return `matches-${query.leagueId}-${query.round ?? ''}-${query.dateFrom}-${query.dateTo}`
  },
})
