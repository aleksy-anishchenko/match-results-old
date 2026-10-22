import type { BracketResponse } from '~/types'

const NO_BRACKET: BracketResponse = { rounds: [], thirdPlace: null }

export default cachedEventHandler(async (event): Promise<BracketResponse> => {
  const query = getQuery(event)
  const leagueId = String(query.leagueId ?? DEFAULT_COMPETITION_ID)
  const competition = getCompetition(leagueId)

  // Сетка есть только у турниров (ЛЧ, ЛЕ, Лига наций), у лиг плей-офф — страница «Плей-офф» среди туров
  if (competition?.type !== 'tournament') return NO_BRACKET

  const season = await getLeagueSeason(leagueId)
  if (season == null) return NO_BRACKET

  const playoffMatches = getPlayoffMatches(await getSeasonMatches(leagueId, season))
  if (!playoffMatches.length) return NO_BRACKET

  return buildBracket(playoffMatches, competition)
}, {
  maxAge: 60,
  getKey: event => `bracket-${getQuery(event).leagueId ?? DEFAULT_COMPETITION_ID}`,
})
