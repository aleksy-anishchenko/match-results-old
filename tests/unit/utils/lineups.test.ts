import { describe, it, expect } from 'vitest'
import { getApiFootballLineups } from '#shared/utils/lineups'
// Настоящие ответы API-Football (fixtures?id=), только нужные поля
import afSpartakRubin from '../../fixtures/api-football/spartak-rubin.json'
import afChampionsLeagueFinal from '../../fixtures/api-football/psg-arsenal-final-2026.json'

describe('getApiFootballLineups', () => {
  // РПЛ 2026/27, Спартак – Рубин: 4-1-4-1 против 5-4-1
  it('стартовые по линиям от вратаря, запасные и тренер', () => {
    const lineups = getApiFootballLineups(afSpartakRubin)!
    expect(lineups.home.formation).toBe('4-1-4-1')
    // Опорный (линия 3) — отдельной линией: так в схеме
    expect(lineups.home.lines.map(line => line.length)).toEqual([1, 4, 1, 4, 1])
    expect(lineups.home.lines[0]).toEqual([{ number: 1, name: 'I. Pomazun' }])
    expect(lineups.home.lines[2]).toEqual([{ number: 18, name: 'N. Umyarov' }])
    expect(lineups.home.substitutes).toHaveLength(11)
    expect(lineups.home.coach).toBe('Carcedo')
    expect(lineups.away.formation).toBe('5-4-1')
    expect(lineups.away.lines.map(line => line.length)).toEqual([1, 5, 4, 1])
    expect(lineups.away.substitutes).toHaveLength(12)
  })

  it('хозяева — по номеру команды, а не по порядку в ответе', () => {
    const swapped = { ...afSpartakRubin, lineups: [...afSpartakRubin.lineups].reverse() }
    expect(getApiFootballLineups(swapped)).toEqual(getApiFootballLineups(afSpartakRubin))
  })

  it('без grid — линии по позиции: вратарь, защитники, полузащитники, нападающие', () => {
    const withoutGrid = {
      ...afChampionsLeagueFinal,
      lineups: afChampionsLeagueFinal.lineups.map(team => ({
        ...team,
        startXI: team.startXI.map(({ player }) => ({ player: { ...player, grid: null } })),
      })),
    }
    const lineups = getApiFootballLineups(withoutGrid)!
    expect(lineups.home.lines.map(line => line.length)).toEqual([1, 4, 3, 3])
  })

  it('составов нет или нет у одной из команд — null', () => {
    expect(getApiFootballLineups({ ...afSpartakRubin, lineups: [] })).toBeNull()
    expect(getApiFootballLineups({ ...afSpartakRubin, lineups: afSpartakRubin.lineups.slice(0, 1) })).toBeNull()
  })
})
