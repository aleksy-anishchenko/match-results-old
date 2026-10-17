import type { RoundsResponse } from '~/types'

export default cachedEventHandler(async (event): Promise<RoundsResponse> => {
  const leagueId = String(getQuery(event).leagueId ?? DEFAULT_COMPETITION_ID)
  const competition = getCompetition(leagueId)
  const season = await getCurrentSeason(leagueId)
  if (!competition || !season) return { season, rounds: [], current: null }

  const schedule = await getSeasonSchedule<BracketScheduleMatch>(leagueId, season)
  const { rounds, roundByMatch } = getSeasonRounds(schedule, competition)

  return { season, rounds, current: getCurrentRound(schedule, roundByMatch, new Date()) }
}, {
  maxAge: 60,
  getKey: event => `rounds-${getQuery(event).leagueId ?? DEFAULT_COMPETITION_ID}`,
})
