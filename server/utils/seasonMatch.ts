import type { SeasonMatch, SeasonTeam } from '~/types'
import { getTeamName } from './teamNames'

type ApiFootballTeam = { id: number, name: string, logo: string }

/** Матч из ответа fixtures?league&season: поля, нужные расписанию */
export type ApiFootballSeasonFixture = {
  fixture: { id: number, timestamp: number, status: { short: string } }
  league: { round: string }
  teams: { home: ApiFootballTeam, away: ApiFootballTeam }
  goals: { home: number | null, away: number | null }
  score: { penalty: { home: number | null, away: number | null } }
}

const toSeasonTeam = (team: ApiFootballTeam): SeasonTeam => ({ id: team.id, name: getTeamName(team.id, team.name), badge: team.logo })

/** Матч расписания в общем виде: названия по-русски, время — UTC без смещения («2026-10-25T16:30:00») */
export function toSeasonMatch({ fixture, league, teams, goals, score }: ApiFootballSeasonFixture): SeasonMatch {
  return {
    id: String(fixture.id),
    round: league.round,
    timestamp: new Date(fixture.timestamp * 1000).toISOString().slice(0, 19),
    status: fixture.status.short,
    home: toSeasonTeam(teams.home),
    away: toSeasonTeam(teams.away),
    homeScore: goals.home,
    awayScore: goals.away,
    homePenalties: score.penalty.home,
    awayPenalties: score.penalty.away,
  }
}
