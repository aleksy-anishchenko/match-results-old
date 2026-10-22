import { describe, it, expect } from 'vitest'
import { getApiFootballStats } from '#shared/utils/matchStats'
// Финал ЛЧ 2026 ПСЖ – Арсенал и Спартак – Рубин из API-Football (fixtures?id=)
import afChampionsLeagueFinal from '../../fixtures/api-football/psg-arsenal-final-2026.json'
import afSpartakRubin from '../../fixtures/api-football/spartak-rubin.json'

describe('getApiFootballStats', () => {
  // В финале ЛЧ API-Football прислал null вместо 0 у части показателей — null считается нулём
  it('показатели по порядку, с подписями; владение и xG — числами', () => {
    expect(getApiFootballStats(afChampionsLeagueFinal).filter(stat => stat.format !== 'decimal')).toEqual([
      { label: 'Владение мячом', home: 75, away: 25, format: 'percent' },
      { label: 'Удары', home: 21, away: 7, format: 'number' },
      { label: 'Удары в створ', home: 4, away: 1, format: 'number' },
      { label: 'Угловые', home: 11, away: 3, format: 'number' },
      { label: 'Офсайды', home: 0, away: 3, format: 'number' },
      { label: 'Фолы', home: 11, away: 17, format: 'number' },
      { label: 'Сейвы', home: 0, away: 3, format: 'number' },
    ])
  })

  // «66%», «3.39» строками, остальное числами
  it('хозяева и гости по номерам команд', () => {
    const stats = getApiFootballStats(afSpartakRubin)
    expect(stats[0]).toEqual({ label: 'Владение мячом', home: 66, away: 34, format: 'percent' })
    expect(stats[1]).toEqual({ label: 'Ожидаемые голы (xG)', home: 3.39, away: 0.32, format: 'decimal' })
    expect(stats.find(stat => stat.label === 'Удары')).toEqual({ label: 'Удары', home: 22, away: 9, format: 'number' })
  })

  it('порядок команд в ответе не важен', () => {
    const swapped = { ...afSpartakRubin, statistics: [...afSpartakRubin.statistics].reverse() }
    expect(getApiFootballStats(swapped)).toEqual(getApiFootballStats(afSpartakRubin))
  })

  it('показателя нет — строки нет', () => {
    const withoutOffsides = {
      ...afSpartakRubin,
      statistics: afSpartakRubin.statistics.map(team => ({ ...team, statistics: team.statistics.filter(stat => stat.type !== 'Offsides') })),
    }
    expect(getApiFootballStats(withoutOffsides).map(stat => stat.label)).not.toContain('Офсайды')
  })

  it('статистики нет или одни нули — пусто', () => {
    expect(getApiFootballStats({ ...afSpartakRubin, statistics: [] })).toEqual([])
    const zeros = {
      ...afSpartakRubin,
      statistics: afSpartakRubin.statistics.map(team => ({ ...team, statistics: team.statistics.map(stat => ({ ...stat, value: 0 })) })),
    }
    expect(getApiFootballStats(zeros)).toEqual([])
  })
})
