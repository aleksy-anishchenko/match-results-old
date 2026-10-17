export default cachedEventHandler(async (event) => {
  const query = getQuery(event)
  const leagueId = String(query.leagueId ?? DEFAULT_COMPETITION_ID)
  const competition = getCompetition(leagueId)

  // Плей-офф есть только у турниров с групповым этапом или общим этапом
  if (!competition?.groupRounds?.length && !competition?.leaguePhase) return { rounds: [] }

  const season = await getCurrentSeason(leagueId)
  if (!season) return { rounds: [] }

  const schedule = await getSeasonSchedule<BracketScheduleMatch>(leagueId, season)
  const playoffMatches = getPlayoffMatches(schedule, competition)
  if (!playoffMatches.length) return { rounds: [] }

  const penScoreMap = await getPenaltyScores(playoffMatches)

  return { rounds: buildBracket(playoffMatches, penScoreMap) }
}, {
  maxAge: 60,
  getKey: event => `bracket-${getQuery(event).leagueId ?? DEFAULT_COMPETITION_ID}`,
})
