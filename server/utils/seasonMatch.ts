import type { Match, SeasonMatch, SeasonTeam } from '~/types'
import { getTeamName } from './teamNames'

/** Команда в ответе. Без номера и названия в данных пока не встречалась, но разбор от неё падать не должен */
type ApiFootballTeam = { id: number | null, name: string | null, logo: string | null }

/** Матч из ответа fixtures?league&season: поля, нужные расписанию */
export type ApiFootballSeasonFixture = {
  fixture: { id: number, timestamp: number, status: { short: string } }
  league: { round: string }
  teams: { home: ApiFootballTeam, away: ApiFootballTeam }
  goals: { home: number | null, away: number | null }
  score: { penalty: { home: number | null, away: number | null } }
}

const toSeasonTeam = (team: ApiFootballTeam): SeasonTeam => ({ id: team.id, name: getTeamName(team.id, team.name), badge: team.logo ?? '' })

/** Время из API (секунды Unix) в UTC без смещения: «2026-10-25T16:30:00» — такое ждут getMoscowDate и formatMoscowTime */
export const toUtcTimestamp = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 19)

/** Голы из API строкой, как счёт у страниц: «2»; null — матч не начался */
export const toScoreText = (goals: number | null) => goals == null ? null : String(goals)

/** Матч расписания в общем виде: названия по-русски, время — UTC без смещения («2026-10-25T16:30:00») */
export function toSeasonMatch({ fixture, league, teams, goals, score }: ApiFootballSeasonFixture): SeasonMatch {
  return {
    id: String(fixture.id),
    round: league.round,
    timestamp: toUtcTimestamp(fixture.timestamp),
    status: fixture.status.short,
    home: toSeasonTeam(teams.home),
    away: toSeasonTeam(teams.away),
    homeScore: goals.home,
    awayScore: goals.away,
    homePenalties: score.penalty.home,
    awayPenalties: score.penalty.away,
  }
}

/** Матч расписания для списка матчей на главной. round — тур матча из getSeasonRounds; null — матч вне туров */
export function toMatch(match: SeasonMatch, round: string | null): Match {
  return {
    id: match.id,
    homeTeam: match.home.name,
    awayTeam: match.away.name,
    homeBadge: match.home.badge,
    awayBadge: match.away.badge,
    homeScore: toScoreText(match.homeScore),
    awayScore: toScoreText(match.awayScore),
    homePenScore: match.homePenalties,
    awayPenScore: match.awayPenalties,
    status: match.status,
    // Минуту и свежий счёт идущего матча подставляет страница из /api/live (useLiveScores)
    progress: null,
    timestamp: match.timestamp,
    round,
  }
}
