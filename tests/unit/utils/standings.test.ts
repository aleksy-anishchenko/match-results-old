import { describe, it, expect } from 'vitest'
import {
  calculateStandings,
  collectLegend,
  formatGroupName,
  formatSeason,
  getStandingZone,
  sortGroups,
} from '#shared/utils/standings'

describe('getStandingZone', () => {
  // Строки взяты из ответов lookuptable для лиг из конфига (сезон 2026/27)
  it.each([
    ['Promotion - Champions League (League phase)', 'tier1', 'Лига чемпионов'],
    ['Champions League league stage', 'tier1', 'Лига чемпионов'],
    ['Promotion - Champions League (Qualification)', 'tier1-qual', 'Квалификация Лиги чемпионов'],
    ['Promotion - Europa League (League phase)', 'tier2', 'Лига Европы'],
    ['Europa League league stage', 'tier2', 'Лига Европы'],
    ['Promotion - Europa League (Qualification)', 'tier2-qual', 'Квалификация Лиги Европы'],
    ['Promotion - Conference League (Qualification)', 'tier3-qual', 'Квалификация Лиги конференций'],
    ['Promotion - Eredivisie (Conference League - Play Offs)', 'tier3-qual', 'Плей-офф за Лигу конференций'],
    ['Relegation - Championship', 'relegation', 'Вылет'],
    ['Relegation', 'relegation', 'Вылет'],
    ['Relegation Playoffs', 'relegation-playoff', 'Стыковые матчи'],
    ['Relegation Play-offs', 'relegation-playoff', 'Стыковые матчи'],
    ['Relegation Play Offs', 'relegation-playoff', 'Стыковые матчи'],
    ['Premier League (Relegation)', 'relegation-playoff', 'Стыковые матчи'],
    ['Eredivisie (Relegation)', 'relegation-playoff', 'Стыковые матчи'],
    ['Promotion - MLS (Play Offs: 1/8-finals)', 'tier1', 'Плей-офф'],
    ['Promotion - MLS (Play Offs: 1/16-finals)', 'tier1-qual', 'Раунд уайлд-кард'],
    ['Promotion - AFC Champions League (League phase)', 'tier1', 'Лига чемпионов АФК'],
    ['Promotion - AFC Champions League (Qualification)', 'tier1-qual', 'Квалификация Лиги чемпионов АФК'],
    ['Promotion - AFC Champions League 2', 'tier2', 'Лига чемпионов АФК 2'],
    ['Promotion - AFC Champions League Two', 'tier2', 'Лига чемпионов АФК 2'],
    ['Promotion - Gulf Club Champions League', 'tier3', 'Лига чемпионов Залива'],
    ['Promotion - Copa Libertadores (Group Stage)', 'tier1', 'Кубок Либертадорес'],
    ['Promotion - Copa Libertadores (Qualification)', 'tier1-qual', 'Квалификация Кубка Либертадорес'],
    ['Promotion - Copa Sudamericana (Group Stage)', 'tier2', 'Южноамериканский кубок'],
    ['Play-offs', 'qual', 'Квалификация'],
    [' Qualifying', 'qual', 'Квалификация'],
  ])('«%s» → %s', (description, kind, label) => {
    expect(getStandingZone(description)).toEqual({ kind, label })
  })

  // Серия А, Бундеслига и Лига 1 пишут зону без названия турнира, расшифровка своя у каждой лиги
  it.each([
    ['4332', 'Play-offs', 'tier3-qual', 'Квалификация Лиги конференций'],
    ['4331', 'Qualifying', 'tier3-qual', 'Квалификация Лиги конференций'],
    ['4334', ' Qualifying', 'tier1-qual', 'Квалификация Лиги чемпионов'],
    ['4334', 'Play-offs', 'tier3-qual', 'Квалификация Лиги конференций'],
  ])('лига %s: «%s» → %s', (leagueId, description, kind, label) => {
    expect(getStandingZone(description, leagueId)).toEqual({ kind, label })
  })

  it('исключения лиги не трогают остальные описания', () => {
    expect(getStandingZone('Relegation Playoffs', '4331')).toEqual({ kind: 'relegation-playoff', label: 'Стыковые матчи' })
    expect(getStandingZone('Champions League league stage', '4334')).toEqual({ kind: 'tier1', label: 'Лига чемпионов' })
  })

  it('без описания зоны нет', () => {
    expect(getStandingZone('')).toBeNull()
    expect(getStandingZone(null)).toBeNull()
    expect(getStandingZone(undefined)).toBeNull()
  })

  it('незнакомое описание не превращается в зону', () => {
    expect(getStandingZone('Round of 32')).toBeNull()
  })
})

describe('collectLegend', () => {
  it('зоны по порядку, без повторов, пустые места пропускает', () => {
    const ucl = { kind: 'tier1', label: 'Лига чемпионов' } as const
    const down = { kind: 'relegation', label: 'Вылет' } as const
    expect(collectLegend([{ zone: ucl }, { zone: ucl }, { zone: null }, { zone: down }])).toEqual([ucl, down])
  })
})

describe('sortGroups', () => {
  it('сортирует по названию, числа по значению', () => {
    const groups = { 'Группа H': 1, 'Группа 10': 2, 'Группа A': 3, 'Группа 2': 4 }
    expect(Object.keys(sortGroups(groups))).toEqual(['Группа 2', 'Группа 10', 'Группа A', 'Группа H'])
  })
})

describe('formatSeason', () => {
  it('сокращает сезон из двух лет', () => {
    expect(formatSeason('2026-2027')).toBe('2026/27')
  })

  it('сезон в один год оставляет как есть', () => {
    expect(formatSeason('2026')).toBe('2026')
  })
})

describe('formatGroupName', () => {
  it('переводит группы и конференции', () => {
    expect(formatGroupName('Group A')).toBe('Группа A')
    expect(formatGroupName('Western Conference')).toBe('Западная конференция')
    expect(formatGroupName('Eastern Conference')).toBe('Восточная конференция')
  })

  it('незнакомое название оставляет как есть', () => {
    expect(formatGroupName('Лига чемпионов')).toBe('Лига чемпионов')
  })
})

describe('calculateStandings', () => {
  function match(home: string, away: string, score: [number, number] | null, status = 'FT') {
    return {
      strHomeTeam: home,
      strAwayTeam: away,
      strHomeTeamBadge: `${home}.png`,
      strAwayTeamBadge: `${away}.png`,
      intHomeScore: score ? String(score[0]) : null,
      intAwayScore: score ? String(score[1]) : null,
      strStatus: status,
    }
  }

  it('считает игры, победы, ничьи, поражения, мячи и очки', () => {
    const [arsenal, chelsea] = calculateStandings([
      match('Arsenal', 'Chelsea', [2, 0]),
      match('Chelsea', 'Arsenal', [1, 1]),
    ])

    expect(arsenal).toEqual({
      team: 'Arsenal', badge: 'Arsenal.png',
      played: 2, won: 1, drawn: 1, lost: 0,
      goalsFor: 3, goalsAgainst: 1, goalDiff: 2, points: 4,
      zone: null,
    })
    expect(chelsea).toMatchObject({ played: 2, won: 0, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 3, goalDiff: -2, points: 1 })
  })

  it('команды без сыгранных матчей тоже в таблице, с нулями', () => {
    const table = calculateStandings([
      match('Arsenal', 'Chelsea', [1, 0]),
      match('Liverpool', 'Everton', null, 'NS'),
    ])

    // Челси с поражением (разница −1) ниже несыгравших команд с нулевой разницей
    expect(table.map(row => row.team)).toEqual(['Arsenal', 'Liverpool', 'Everton', 'Chelsea'])
    expect(table[1]).toMatchObject({ team: 'Liverpool', badge: 'Liverpool.png', played: 0, points: 0 })
  })

  it('матчи после доп. времени и пенальти тоже считаются завершёнными', () => {
    const [arsenal, chelsea] = calculateStandings([
      match('Arsenal', 'Chelsea', [2, 1], 'AET'),
      match('Chelsea', 'Arsenal', [0, 0], 'AP'),
    ])

    expect(arsenal).toMatchObject({ played: 2, won: 1, drawn: 1, points: 4 })
    expect(chelsea).toMatchObject({ played: 2, lost: 1, drawn: 1, points: 1 })
  })

  it('идущие и отменённые матчи не считаются', () => {
    const [first] = calculateStandings([
      match('Arsenal', 'Chelsea', [3, 0], '2H'),
      match('Arsenal', 'Everton', [0, 0], 'PST'),
    ])

    expect(first).toMatchObject({ played: 0, points: 0, goalsFor: 0 })
  })

  it('порядок: очки, потом разница мячей, потом забитые', () => {
    const table = calculateStandings([
      match('A', 'X', [1, 0]), // A: 3 очка, +1
      match('B', 'Y', [3, 1]), // B: 3 очка, +2
      match('C', 'Z', [4, 2]), // C: 3 очка, +2, забил больше B
      match('D', 'W', [0, 0]), // D: 1 очко
    ])

    expect(table.slice(0, 4).map(row => row.team)).toEqual(['C', 'B', 'A', 'D'])
  })
})
