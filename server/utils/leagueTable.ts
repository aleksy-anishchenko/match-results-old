import type { Competition, GroupStanding } from '~/types'
import { formatGroupName, getLeaguePhaseZone, getStandingZone, sortGroups } from '#shared/utils/standings'
import { getTeamName } from './teamNames'

/** Строка таблицы из ответа standings API-Football: поля, нужные странице */
export type ApiFootballStandingRow = {
  rank: number
  /** Бывает без номера и эмблемы: «Sabah FC» в таблице ЛЧ 2026/27 (в расписании у неё номер есть) */
  team: { id: number | null, name: string, logo: string | null }
  points: number
  goalsDiff: number
  /** Группа: у лиги — её название, у МЛС — конференция, у Лиги наций — «League A - Group B» */
  group: string
  /** Куда попадает команда с этого места: «Promotion - Champions League (League phase)»; null — никуда */
  description: string | null
  all: { played: number, win: number, draw: number, lose: number, goals: { for: number, against: number } }
}

/**
 * Таблица турнира по группам: группы и команды по-русски, зоны. У лиги группа одна, у МЛС — две конференции,
 * у Лиги наций — 14 групп. У общего этапа ЛЧ/ЛЕ/ЛК зоны по месту, у остальных — по описанию из API
 */
export function toLeagueTable(
  groups: ApiFootballStandingRow[][],
  competition: Pick<Competition, 'id' | 'leaguePhase'>,
): Record<string, GroupStanding[]> {
  const table: Record<string, GroupStanding[]> = {}
  for (const rows of groups) {
    if (!rows[0]) continue
    table[formatGroupName(rows[0].group)] = rows.map(row => ({
      team: getTeamName(row.team.id, row.team.name),
      badge: row.team.logo ?? '',
      played: row.all.played,
      won: row.all.win,
      drawn: row.all.draw,
      lost: row.all.lose,
      goalsFor: row.all.goals.for,
      goalsAgainst: row.all.goals.against,
      goalDiff: row.goalsDiff,
      points: row.points,
      zone: competition.leaguePhase ? getLeaguePhaseZone(row.rank) : getStandingZone(row.description, competition.id),
    }))
  }
  return sortGroups(table)
}
