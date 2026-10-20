import type { MatchStat } from '~/types'
import type { ApiFootballFixture } from './matchEvents'

/** Показатель из lookupeventstats TheSportsDB. Значения строками: «66», «1.77» */
export type TheSportsDbStat = {
  strStat: string
  intHome: string | number | null
  intAway: string | number | null
}

/** Что показываем и в каком порядке. Названия показателей у TheSportsDB и API-Football одинаковые */
const MATCH_STATS: Array<{ name: string, label: string, format: MatchStat['format'] }> = [
  { name: 'Ball Possession', label: 'Владение мячом', format: 'percent' },
  { name: 'expected_goals', label: 'Ожидаемые голы (xG)', format: 'decimal' },
  { name: 'Total Shots', label: 'Удары', format: 'number' },
  { name: 'Shots on Goal', label: 'Удары в створ', format: 'number' },
  { name: 'Corner Kicks', label: 'Угловые', format: 'number' },
  { name: 'Offsides', label: 'Офсайды', format: 'number' },
  { name: 'Fouls', label: 'Фолы', format: 'number' },
  { name: 'Goalkeeper Saves', label: 'Сейвы', format: 'number' },
]

/** «66%» и «3.39» у API-Football, «66» у TheSportsDB. null — у API-Football это 0 */
const toNumber = (value: string | number | null | undefined) => Number(String(value ?? 0).replace('%', '')) || 0

/**
 * Показатели из списка MATCH_STATS: название → [хозяева, гости]. Каких нет — пропускаем.
 * Все нули — статистику у матча не собирали, а не сыграли «по нулям»: тогда её нет совсем
 */
function pickStats(values: Map<string, [number, number]>): MatchStat[] {
  const stats = MATCH_STATS.flatMap(({ name, label, format }): MatchStat[] => {
    const pair = values.get(name)
    return pair ? [{ label, home: pair[0], away: pair[1], format }] : []
  })
  return stats.some(stat => stat.home || stat.away) ? stats : []
}

/** Статистика матча из TheSportsDB */
export function getTheSportsDbStats(stats: TheSportsDbStat[]): MatchStat[] {
  return pickStats(new Map(stats.map(stat => [stat.strStat, [toNumber(stat.intHome), toNumber(stat.intAway)]])))
}

/** Статистика матча из API-Football: там она по командам, хозяев узнаём по номеру команды */
export function getApiFootballStats(fixture: ApiFootballFixture): MatchStat[] {
  const home = fixture.statistics?.find(team => team.team.id === fixture.teams.home.id)
  const away = fixture.statistics?.find(team => team.team.id === fixture.teams.away.id)
  if (!home || !away) return []
  const awayValues = new Map(away.statistics.map(stat => [stat.type, toNumber(stat.value)]))
  return pickStats(new Map(home.statistics.map(stat => [stat.type, [toNumber(stat.value), awayValues.get(stat.type) ?? 0]])))
}
