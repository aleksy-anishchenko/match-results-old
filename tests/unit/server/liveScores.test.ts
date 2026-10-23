import { describe, it, expect } from 'vitest'
import { toLiveScore, type ApiFootballLiveFixture } from '../../../server/utils/liveScores'

const fixture = (status: string, elapsed: number | null, extra: number | null, overrides: Partial<ApiFootballLiveFixture> = {}): ApiFootballLiveFixture => ({
  fixture: { id: 1, status: { short: status, elapsed, extra } },
  league: { id: 3 },
  goals: { home: 0, away: 4 },
  score: { penalty: { home: null, away: null } },
  ...overrides,
})

describe('toLiveScore', () => {
  // Лиллестрём – Реал Сосьедад, Лига Европы 22 октября 2026
  it('идущий матч: счёт и минута', () => {
    expect(toLiveScore(fixture('2H', 67, null))).toEqual({
      status: '2H', progress: '67', homeScore: 0, awayScore: 4, homePenScore: null, awayPenScore: null,
    })
  })

  it('добавленное время — «45+2», в перерыве минуты нет', () => {
    expect(toLiveScore(fixture('1H', 45, 2)).progress).toBe('45+2')
    expect(toLiveScore(fixture('HT', 45, 4)).progress).toBeNull()
  })

  it('решён по пенальти — счёт серии', () => {
    const shootout = fixture('PEN', 120, null, { goals: { home: 1, away: 1 }, score: { penalty: { home: 4, away: 3 } } })
    expect(toLiveScore(shootout)).toMatchObject({ status: 'PEN', progress: null, homePenScore: 4, awayPenScore: 3 })
  })

  it('у обычного матча нули в полях пенальти — не серия', () => {
    const regular = fixture('FT', 90, null, { score: { penalty: { home: 0, away: 0 } } })
    expect(toLiveScore(regular)).toMatchObject({ homePenScore: null, awayPenScore: null })
  })

  it('матч не начался — счёта нет', () => {
    expect(toLiveScore(fixture('NS', null, null, { goals: { home: null, away: null } }))).toMatchObject({ homeScore: null, awayScore: null, progress: null })
  })
})
