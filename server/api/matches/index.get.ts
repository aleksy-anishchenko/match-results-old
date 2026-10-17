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
  // Тур (?round=5) или диапазон дат (?dateFrom=…&dateTo=…): на главной выбирают что-то одно
  const round = typeof query.round === 'string' && query.round ? query.round : null

  const today = getMoscowDate(new Date())
  const dateFrom = String(query.dateFrom ?? today)
  const dateTo = String(query.dateTo ?? today)

  const season = await getCurrentSeason(leagueId)
  if (!season) return { matches: [] }

  const schedule = await getSeasonSchedule<ApiMatch>(leagueId, season)

  const roundByMatch = round && competition ? getSeasonRounds(schedule, competition).roundByMatch : null

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
    progress: null, // schedule endpoint doesn't return live-match progress
    timestamp: match.strTimestamp,
    date: match.dateEvent,
    group: match.strGroup,
    season: match.strSeason,
  }))

  return { matches }
}, {
  maxAge: 60,
  getKey: (event) => {
    const query = getQuery(event)
    return `matches-${query.leagueId}-${query.round ?? ''}-${query.dateFrom}-${query.dateTo}`
  },
})
