import type { BracketResponse } from '~/types'

const NO_BRACKET: BracketResponse = { rounds: [], thirdPlace: null }

export default defineEventHandler(async (event): Promise<BracketResponse> => {
  const competition = getRequestedCompetition(getQuery(event).leagueId)
  // Сетка есть только у турниров (еврокубки, Лига наций), у лиг плей-офф — страница «Плей-офф» среди туров.
  // У лиг API-Football и не спрашиваем: ни лимит, ни его сбой маршрута, где сетки не бывает, не касаются
  if (competition?.type !== 'tournament') return NO_BRACKET

  const season = await getLeagueSeason(competition.id)
  if (season == null) return NO_BRACKET

  const playoffMatches = getPlayoffMatches(await getSeasonMatches(competition.id, season))
  if (!playoffMatches.length) return NO_BRACKET

  return buildBracket(playoffMatches, competition)
})
