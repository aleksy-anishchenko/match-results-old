import type { MatchDetails } from '~/types'
import { FINISHED_MATCH_STATUSES, goalsMatchScore } from '#shared/utils/matches'
import { getRoundNumber } from '#shared/utils/rounds'
import { getApiFootballLineups } from './lineups'
import { getApiFootballEvents } from './matchEvents'
import { getApiFootballStats } from './matchStats'
import { toPenalties, toUtcTimestamp } from './seasonMatch'
import { getTeamName } from './teamNames'
import { decodeEntities } from './text'

/**
 * Матч из API-Football (fixtures?id=…): поля, нужные странице матча — шапке, хронике, статистике и составам.
 * Списки обычно приходят и пустыми, но если какого-то нет, разбор не должен падать — поэтому они необязательные
 */
export type ApiFootballFixture = {
  fixture: {
    id: number
    /** Начало матча, секунды Unix */
    timestamp: number
    venue: { name: string | null, city: string | null }
    status: { short: string }
  }
  /** round — как в расписании: «Regular Season - 11», «Final» */
  league: { id: number, name: string, season: number, round: string }
  teams: { home: { id: number, name: string, logo: string }, away: { id: number, name: string, logo: string } }
  goals: { home: number | null, away: number | null }
  score: { penalty: { home: number | null, away: number | null } }
  events?: Array<{
    time: { elapsed: number | null, extra: number | null }
    team: { id: number }
    /** У замены — ушедший с поля */
    player: { name: string | null }
    /** У гола — автор паса, у замены — вышедший на поле */
    assist: { name: string | null }
    type: string
    detail: string
    comments: string | null
  }>
  /** По команде на каждую; пусто, если статистики у матча нет */
  statistics?: Array<{
    team: { id: number }
    statistics: Array<{ type: string, value: number | string | null }>
  }>
  /** По команде на каждую; пусто, если составов нет */
  lineups?: Array<{
    team: { id: number }
    formation: string | null
    startXI: ApiFootballLineupPlayer[]
    substitutes: ApiFootballLineupPlayer[]
    coach: { name: string | null } | null
  }>
}

/** Игрок в составе API-Football. grid — «линия:место», линия 1 — вратарь; pos — G, D, M, F */
export type ApiFootballLineupPlayer = {
  player: { name: string | null, number: number | null, pos: string | null, grid: string | null }
}

/**
 * Страница матча из ответа fixtures?id=. У сыгранного матча хроника — только если её голы сходятся со счётом:
 * неполный список голов выглядит как ошибка. У идущего — без сверки: свежий счёт страница берёт из живых данных
 * и сверяет хронику с ним сама
 */
export function toMatchDetails(fixture: ApiFootballFixture): MatchDetails {
  const { fixture: info, league, teams, goals, score } = fixture
  const events = getApiFootballEvents(fixture)
  const penalties = toPenalties(info.status.short, score.penalty)
  const eventsFit = !FINISHED_MATCH_STATUSES.has(info.status.short) || goalsMatchScore(events, goals.home, goals.away)

  return {
    id: String(info.id),
    homeTeam: getTeamName(teams.home.id, teams.home.name),
    awayTeam: getTeamName(teams.away.id, teams.away.name),
    homeBadge: teams.home.logo,
    awayBadge: teams.away.logo,
    homeScore: goals.home,
    awayScore: goals.away,
    homePenScore: penalties.home,
    awayPenScore: penalties.away,
    status: info.status.short,
    // Минуту идущего матча подставляет страница из /api/live (useLiveScores)
    progress: null,
    timestamp: toUtcTimestamp(info.timestamp),
    leagueId: String(league.id),
    league: league.name,
    round: getRoundNumber(league.round),
    venue: info.venue.name && decodeEntities(info.venue.name),
    city: info.venue.city && decodeEntities(info.venue.city),
    events: eventsFit ? events : [],
    stats: getApiFootballStats(fixture),
    lineups: getApiFootballLineups(fixture),
  }
}
