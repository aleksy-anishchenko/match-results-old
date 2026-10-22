import { describe, it, expect } from 'vitest'
import { toLeagueTable } from '../../../server/utils/leagueTable'
// Настоящие таблицы из API-Football (standings), только нужные поля
import championsLeague2627 from '../../fixtures/api-football/standings/champions-league-2026-27.json'
import nationsLeague2627 from '../../fixtures/api-football/standings/nations-league-2026-27.json'
import mls2026 from '../../fixtures/api-football/standings/mls-2026.json'
import ligue12627 from '../../fixtures/api-football/standings/ligue-1-2026-27.json'

const zoneOf = (table: ReturnType<typeof toLeagueTable>, team: string) =>
  Object.values(table).flat().find(row => row.team === team)?.zone?.label ?? null

describe('toLeagueTable', () => {
  it('лига: одна группа, команды по-русски, игры и очки из строки API', () => {
    const table = toLeagueTable(ligue12627, { id: '61' })
    const [rows] = Object.values(table)
    expect(Object.keys(table)).toHaveLength(1)
    expect(rows).toHaveLength(18)
    expect(rows![0]).toEqual({
      team: 'Лион',
      badge: '',
      played: 7,
      won: 4,
      drawn: 2,
      lost: 1,
      goalsFor: 13,
      goalsAgainst: 5,
      goalDiff: 8,
      points: 14,
      zone: { kind: 'tier1', label: 'Лига чемпионов' },
    })
  })

  // Лига 1 пишет зоны без названия турнира («Qualifying», «Play-offs») — расшифровка по правилам лиги
  it('лига: зоны по описанию, со своими правилами лиги', () => {
    const table = toLeagueTable(ligue12627, { id: '61' })
    expect(zoneOf(table, 'Лилль')).toBe('Квалификация Лиги чемпионов')
    expect(zoneOf(table, 'Ренн')).toBe('Квалификация Лиги конференций')
    expect(zoneOf(table, 'Ле Ман')).toBe('Стыковые матчи')
    expect(zoneOf(table, 'Труа')).toBe('Вылет')
  })

  it('общий этап ЛЧ: зоны по месту', () => {
    const table = toLeagueTable(championsLeague2627, { id: '2', leaguePhase: true })
    const [rows] = Object.values(table)
    expect(rows).toHaveLength(36)
    expect(rows!.map(row => [row.team, row.zone?.label]).filter((_, index) => [0, 8, 24].includes(index))).toEqual([
      ['ПСЖ', '1/8 финала'],
      ['Комо', 'Раунд плей-офф'],
      // В таблице API у этой команды нет номера — перевести не по чему
      ['Sabah FC', 'Выбывание'],
    ])
  })

  it('МЛС: две конференции по-русски', () => {
    const table = toLeagueTable(mls2026, { id: '253' })
    expect(Object.keys(table)).toEqual(['Восточная конференция', 'Западная конференция'])
    expect(zoneOf(table, 'Ванкувер Уайткэпс')).toBe('Плей-офф')
    expect(zoneOf(table, 'ЛА Гэлакси')).toBe('Раунд уайлд-кард')
    expect(zoneOf(table, 'Реал Солт-Лейк')).toBeNull()
  })

  it('Лига наций: 14 групп по порядку лиг', () => {
    const names = Object.keys(toLeagueTable(nationsLeague2627, { id: '5' }))
    expect(names).toHaveLength(14)
    expect([names[0], names[4], names.at(-1)]).toEqual(['Лига A, группа A', 'Лига B, группа A', 'Лига D, группа B'])
  })

  // Сезон 2026/27 переходный: судьбу 3–4 мест Лиги A решает сравнение групп, Лига D упраздняется
  it('Лига наций: зоны по формату 2026/27', () => {
    const table = toLeagueTable(nationsLeague2627, { id: '5' })
    expect(zoneOf(table, 'Франция')).toBe('Четвертьфинал')
    expect(zoneOf(table, 'Бельгия')).toBe('Возможны стыковые матчи')
    expect(zoneOf(table, 'Швейцария')).toBe('Повышение')
    expect(zoneOf(table, 'Словения')).toBe('Стыковые матчи за повышение')
    expect(zoneOf(table, 'Шотландия')).toBeNull()
    expect(zoneOf(table, 'Северная Македония')).toBe('Стыковые матчи')
    expect(zoneOf(table, 'Мальта')).toBe('Повышение')
  })
})
