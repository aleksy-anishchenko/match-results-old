import type { RoundsResponse } from '~/types'

export default defineEventHandler(async (event): Promise<RoundsResponse> => {
  const leagueId = String(getQuery(event).leagueId ?? DEFAULT_COMPETITION_ID)
  const competition = getCompetition(leagueId)
  // Турниры не из списка не спрашиваем: каждый запрос к API-Football — из дневного лимита
  const season = competition ? await getLeagueSeason(leagueId) : null
  if (!competition || season == null) return { season: null, rounds: [], current: null, matchDays: [] }

  const schedule = await getSeasonMatches(leagueId, season)
  const { rounds, roundByMatch } = getSeasonRounds(schedule, competition)

  return {
    season: String(season),
    rounds,
    current: getCurrentRound(schedule, roundByMatch, new Date()),
    matchDays: getMatchDays(schedule),
  }
})
