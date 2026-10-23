import type { RoundsResponse } from '~/types'

export default defineEventHandler(async (event): Promise<RoundsResponse> => {
  const league = await getCompetitionSeason(getQuery(event).leagueId)
  if (!league) return { season: null, rounds: [], current: null, matchDays: [] }

  const schedule = await getSeasonMatches(league.competition.id, league.season)
  const { rounds, roundByMatch } = getSeasonRounds(schedule, league.competition)

  return {
    season: String(league.season),
    rounds,
    current: getCurrentRound(schedule, roundByMatch, new Date()),
    matchDays: getMatchDays(schedule),
  }
})
