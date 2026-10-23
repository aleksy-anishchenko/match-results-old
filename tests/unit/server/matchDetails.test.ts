import { describe, it, expect } from 'vitest'
import { toMatchDetails } from '../../../server/utils/matchDetails'
// Настоящие ответы API-Football (fixtures?id=), только поля для страницы матча
import afSpartakRubin from '../../fixtures/api-football/spartak-rubin.json'
import afChampionsLeagueFinal from '../../fixtures/api-football/psg-arsenal-final-2026.json'
import afBragantinoCruzeiro from '../../fixtures/api-football/bragantino-cruzeiro.json'

describe('toMatchDetails', () => {
  it('шапка: команды по-русски, счёт строками, время UTC без смещения, тур, стадион', () => {
    const details = toMatchDetails(afSpartakRubin)
    expect(details).toMatchObject({
      id: '1561417',
      homeTeam: 'Спартак',
      awayTeam: 'Рубин',
      homeScore: 4,
      awayScore: 0,
      homePenScore: null,
      status: 'FT',
      progress: null,
      timestamp: '2026-10-18T15:45:00',
      leagueId: '235',
      league: 'Premier League',
      round: '11',
      venue: 'Lukoil Arena',
      city: 'Moscow',
    })
    expect(details.events).toHaveLength(18)
    expect(details.stats.length).toBeGreaterThan(0)
    expect(details.lineups?.home.formation).toBe('4-1-4-1')
  })

  // У Брагантино в составе «Sant&apos;Anna» — так прислал API
  it('HTML-коды в именах и стадионе расшифрованы', () => {
    const details = toMatchDetails(afBragantinoCruzeiro)
    expect(details.lineups?.home.substitutes.map(player => player.name)).toContain('A. Sant\'Anna')
    expect(toMatchDetails({ ...afBragantinoCruzeiro, fixture: { ...afBragantinoCruzeiro.fixture, venue: { name: 'Inter&amp;Co Stadium', city: null } } }).venue)
      .toBe('Inter&Co Stadium')
  })

  it('финал по пенальти: счёт серии, раунд без номера тура', () => {
    expect(toMatchDetails(afChampionsLeagueFinal)).toMatchObject({
      homeTeam: 'ПСЖ',
      awayTeam: 'Арсенал',
      homeScore: 1,
      awayScore: 1,
      homePenScore: 4,
      awayPenScore: 3,
      status: 'PEN',
      leagueId: '2',
      round: null,
    })
  })

  // Хроника неполная: неполный список голов выглядит как ошибка
  it('сыгранный матч: голы хроники не сходятся со счётом — хроники нет, статистика и составы остаются', () => {
    const details = toMatchDetails({ ...afSpartakRubin, goals: { home: 5, away: 0 } })
    expect(details.events).toEqual([])
    expect(details.stats.length).toBeGreaterThan(0)
    expect(details.lineups).not.toBeNull()
  })

  // Счёт в ответе отстаёт от живых данных: хронику страница сверяет со свежим счётом сама
  it('идущий матч: хроника без сверки со счётом', () => {
    const live = { ...afSpartakRubin, goals: { home: 3, away: 0 }, fixture: { ...afSpartakRubin.fixture, status: { ...afSpartakRubin.fixture.status, short: '2H' } } }
    expect(toMatchDetails(live).events).toHaveLength(18)
  })

  it('матч ещё не начался: счёта, хроники и составов нет', () => {
    const upcoming = {
      ...afSpartakRubin,
      fixture: { ...afSpartakRubin.fixture, status: { ...afSpartakRubin.fixture.status, short: 'NS' } },
      goals: { home: null, away: null },
      events: [],
      statistics: [],
      lineups: [],
    }
    expect(toMatchDetails(upcoming)).toMatchObject({ homeScore: null, awayScore: null, events: [], stats: [], lineups: null })
  })
})
