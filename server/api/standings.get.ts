import type { StandingsResponse } from '~/types'

export default cachedEventHandler(async (event): Promise<StandingsResponse> => {
  const leagueId = String(getQuery(event).leagueId ?? DEFAULT_COMPETITION_ID)
  const competition = getCompetition(leagueId)
  // Турниры не из списка не спрашиваем: каждый запрос к API-Football — из дневного лимита
  const season = competition ? await getLeagueSeason(leagueId) : null
  if (!competition || season == null) return { groups: {}, season: null }

  const groups = await getLeagueStandings(leagueId, season)
  return { groups: toLeagueTable(groups, competition), season: String(season) }
}, {
  maxAge: 60,
  getKey: event => `standings-${getQuery(event).leagueId ?? DEFAULT_COMPETITION_ID}`,
})
