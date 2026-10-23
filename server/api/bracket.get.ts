import type { BracketResponse } from '~/types'

const NO_BRACKET: BracketResponse = { rounds: [], thirdPlace: null }

export default defineEventHandler(async (event): Promise<BracketResponse> => {
  // Сезон лиги лишнего запроса не стоит: страница таблицы спрашивает его тут же для /api/standings
  const league = await getCompetitionSeason(getQuery(event).leagueId)
  // Сетка есть только у турниров (ЛЧ, ЛЕ, Лига наций), у лиг плей-офф — страница «Плей-офф» среди туров
  if (league?.competition.type !== 'tournament') return NO_BRACKET

  const playoffMatches = getPlayoffMatches(await getSeasonMatches(league.competition.id, league.season))
  if (!playoffMatches.length) return NO_BRACKET

  return buildBracket(playoffMatches, league.competition)
})
