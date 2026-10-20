import { describe, it, expect } from 'vitest'
import { getApiFootballStats, getTheSportsDbStats } from '#shared/utils/matchStats'
// Настоящая статистика TheSportsDB (v1 lookupeventstats): финал ЛЧ 2026 ПСЖ – Арсенал
import championsLeagueFinal from '../../fixtures/stats/champions-league-final-2026.json'
import excelsiorGroningen from '../../fixtures/stats/excelsior-groningen.json'
// Тот же финал и Спартак – Рубин из API-Football (fixtures?id=)
import afChampionsLeagueFinal from '../../fixtures/api-football/psg-arsenal-final-2026.json'
import afSpartakRubin from '../../fixtures/api-football/spartak-rubin.json'

describe('getTheSportsDbStats', () => {
  it('показатели по порядку, с подписями; владение и xG — числами', () => {
    expect(getTheSportsDbStats(championsLeagueFinal)).toEqual([
      { label: 'Владение мячом', home: 75, away: 25, format: 'percent' },
      { label: 'Ожидаемые голы (xG)', home: 1.77, away: 0.44, format: 'decimal' },
      { label: 'Удары', home: 21, away: 7, format: 'number' },
      { label: 'Удары в створ', home: 4, away: 1, format: 'number' },
      { label: 'Угловые', home: 11, away: 3, format: 'number' },
      { label: 'Офсайды', home: 0, away: 3, format: 'number' },
      { label: 'Фолы', home: 11, away: 17, format: 'number' },
      { label: 'Сейвы', home: 0, away: 3, format: 'number' },
    ])
  })

  // У части матчей TheSportsDB не присылает офсайды
  it('показателя нет — строки нет', () => {
    const stats = getTheSportsDbStats(championsLeagueFinal.filter(stat => stat.strStat !== 'Offsides'))
    expect(stats.map(stat => stat.label)).not.toContain('Офсайды')
    expect(stats).toHaveLength(7)
  })

  it('нет статистики или одни нули — блока нет', () => {
    expect(getTheSportsDbStats([])).toEqual([])
    expect(getTheSportsDbStats(excelsiorGroningen.map(stat => ({ ...stat, intHome: '0', intAway: '0' })))).toEqual([])
  })
})

describe('getApiFootballStats', () => {
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

  // В финале ЛЧ API-Football прислал null вместо 0 у красных карточек — null считается нулём
  it('совпадает с TheSportsDB на том же матче, кроме xG', () => {
    const fromApiFootball = getApiFootballStats(afChampionsLeagueFinal).filter(stat => stat.format !== 'decimal')
    const fromTheSportsDb = getTheSportsDbStats(championsLeagueFinal).filter(stat => stat.format !== 'decimal')
    expect(fromApiFootball).toEqual(fromTheSportsDb)
  })

  it('статистики нет — пусто', () => {
    expect(getApiFootballStats({ ...afSpartakRubin, statistics: [] })).toEqual([])
  })
})
