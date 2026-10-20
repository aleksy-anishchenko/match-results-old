import type { LiveScoresResponse } from '~/types'

// Счёт и минута идущих матчей лиги: главная и страница матча спрашивают их раз в минуту, пока матч идёт
// (useLiveScores). Обработчик не кэшируется: getLiveMatches сам ходит в TheSportsDB не чаще раза в 30 секунд
export default defineEventHandler(async (event): Promise<LiveScoresResponse> => {
  const leagueId = String(getQuery(event).leagueId ?? '')
  const matches = await getLiveMatches()
  return {
    scores: Object.fromEntries(matches
      .filter(match => match.idLeague === leagueId)
      .map(match => [match.idEvent, {
        status: match.strStatus,
        progress: match.strProgress || null,
        homeScore: match.intHomeScore,
        awayScore: match.intAwayScore,
      }])),
  }
})
