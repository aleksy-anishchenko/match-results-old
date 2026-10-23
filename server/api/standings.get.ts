import type { StandingsResponse } from '~/types'

export default defineEventHandler(async (event): Promise<StandingsResponse> => {
  const league = await getCompetitionSeason(getQuery(event).leagueId)
  if (!league) return { groups: {}, season: null }

  const groups = await getLeagueStandings(league.competition.id, league.season)
  return { groups: toLeagueTable(groups, league.competition), season: String(league.season) }
})
