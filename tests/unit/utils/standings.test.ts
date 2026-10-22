import { describe, it, expect } from 'vitest'
import {
  collectLegend,
  formatGroupName,
  getLeaguePhaseZone,
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
    ['135', 'Play-offs', 'tier3-qual', 'Квалификация Лиги конференций'],
    ['78', 'Qualifying', 'tier3-qual', 'Квалификация Лиги конференций'],
    ['61', ' Qualifying', 'tier1-qual', 'Квалификация Лиги чемпионов'],
    ['61', 'Play-offs', 'tier3-qual', 'Квалификация Лиги конференций'],
  ])('лига %s: «%s» → %s', (leagueId, description, kind, label) => {
    expect(getStandingZone(description, leagueId)).toEqual({ kind, label })
  })

  it('исключения лиги не трогают остальные описания', () => {
    expect(getStandingZone('Relegation Playoffs', '78')).toEqual({ kind: 'relegation-playoff', label: 'Стыковые матчи' })
    expect(getStandingZone('Champions League league stage', '61')).toEqual({ kind: 'tier1', label: 'Лига чемпионов' })
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

describe('getLeaguePhaseZone', () => {
  it.each([
    [1, 'tier1', '1/8 финала'],
    [8, 'tier1', '1/8 финала'],
    [9, 'tier1-qual', 'Раунд плей-офф'],
    [24, 'tier1-qual', 'Раунд плей-офф'],
    [25, 'relegation', 'Выбывание'],
    [36, 'relegation', 'Выбывание'],
  ])('%i место → %s', (position, kind, label) => {
    expect(getLeaguePhaseZone(position)).toEqual({ kind, label })
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

describe('formatGroupName', () => {
  it('переводит группы и конференции', () => {
    expect(formatGroupName('Group A')).toBe('Группа A')
    expect(formatGroupName('Western Conference')).toBe('Западная конференция')
    expect(formatGroupName('Eastern Conference')).toBe('Восточная конференция')
    expect(formatGroupName('League B - Group D')).toBe('Лига B, группа D')
  })

  it('незнакомое название оставляет как есть', () => {
    expect(formatGroupName('Лига чемпионов')).toBe('Лига чемпионов')
  })
})
