import type { BracketResponse } from '~/types'

const NO_BRACKET: BracketResponse = { rounds: [], thirdPlace: null }

export default cachedEventHandler(async (event): Promise<BracketResponse> => {
  const query = getQuery(event)
  const leagueId = String(query.leagueId ?? DEFAULT_COMPETITION_ID)
  const competition = getCompetition(leagueId)

  // Плей-офф есть только у турниров с групповым этапом или общим этапом
  if (!competition?.groupRounds?.length && !competition?.leaguePhase) return NO_BRACKET

  const season = await getCurrentSeason(leagueId)
  if (!season) return NO_BRACKET

  const schedule = await getSeasonSchedule<BracketScheduleMatch>(leagueId, season)
  const playoffMatches = getPlayoffMatches(schedule, competition)
  if (!playoffMatches.length) return NO_BRACKET

  const penScoreMap = await getPenaltyScores(playoffMatches)

  return buildBracket(playoffMatches, penScoreMap, competition)
}, {
  maxAge: 60,
  getKey: event => `bracket-${getQuery(event).leagueId ?? DEFAULT_COMPETITION_ID}`,
})
