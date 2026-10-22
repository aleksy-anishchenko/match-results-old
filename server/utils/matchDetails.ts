import type { MatchDetails } from '~/types'
import { getApiFootballEvents, goalsMatchScore, type ApiFootballFixture } from '#shared/utils/matchEvents'
import { getApiFootballLineups } from '#shared/utils/lineups'
import { FINISHED_MATCH_STATUSES } from '#shared/utils/matches'
import { getApiFootballStats } from '#shared/utils/matchStats'
import { getRoundNumber } from '#shared/utils/rounds'
import { decodeEntities } from '#shared/utils/text'
import { toScoreText, toUtcTimestamp } from './seasonMatch'
import { getTeamName } from './teamNames'

/**
 * Страница матча из ответа fixtures?id=. У сыгранного матча хроника — только если её голы сходятся со счётом:
 * неполный список голов выглядит как ошибка. У идущего — без сверки: свежий счёт страница берёт из живых данных
 * и сверяет хронику с ним сама
 */
export function toMatchDetails(fixture: ApiFootballFixture): MatchDetails {
  const { fixture: info, league, teams, goals, score } = fixture
  const homeScore = toScoreText(goals.home)
  const awayScore = toScoreText(goals.away)
  const timestamp = toUtcTimestamp(info.timestamp)
  const events = getApiFootballEvents(fixture)
  const eventsFit = !FINISHED_MATCH_STATUSES.has(info.status.short) || goalsMatchScore(events, homeScore, awayScore)

  return {
    idEvent: String(info.id),
    homeTeam: getTeamName(teams.home.id, teams.home.name),
    awayTeam: getTeamName(teams.away.id, teams.away.name),
    homeBadge: teams.home.logo,
    awayBadge: teams.away.logo,
    homeScore,
    awayScore,
    homePenScore: score.penalty.home,
    awayPenScore: score.penalty.away,
    status: info.status.short,
    // Минуту идущего матча подставляет страница из /api/live (useLiveScores)
    progress: null,
    timestamp,
    date: timestamp.slice(0, 10),
    leagueId: String(league.id),
    league: league.name,
    season: String(league.season),
    round: getRoundNumber(league.round),
    venue: info.venue.name && decodeEntities(info.venue.name),
    city: info.venue.city && decodeEntities(info.venue.city),
    events: eventsFit ? events : [],
    stats: getApiFootballStats(fixture),
    lineups: getApiFootballLineups(fixture),
  }
}
