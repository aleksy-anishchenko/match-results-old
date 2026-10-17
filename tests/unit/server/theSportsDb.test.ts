import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCurrentSeason, getPenaltyScores, getSeasonSchedule } from '../../../server/utils/theSportsDb'

const API = 'https://www.thesportsdb.com/api/v2/json/schedule'
const LOOKUP = 'https://www.thesportsdb.com/api/v1/json/test-key/lookupevent.php?id='
// Так TheSportsDB отвечает, когда матчей нет: без поля schedule
const NO_DATA = { Message: 'No data found' }

// Глобальные $fetch и useRuntimeConfig в Nitro авто-импортируются, в тесте подменяем их заглушками
function mockApi(responses: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string) => {
    if (!(url in responses)) throw new Error(`Неожиданный запрос: ${url}`)
    return responses[url]
  })
  vi.stubGlobal('$fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.stubGlobal('useRuntimeConfig', () => ({ theSportsDbApiKey: 'test-key' }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getCurrentSeason', () => {
  it('берёт сезон у ближайшего матча', async () => {
    const fetchMock = mockApi({
      [`${API}/next/league/4480`]: { schedule: [{ strSeason: '2026-2027' }] },
    })

    expect(await getCurrentSeason('4480')).toBe('2026-2027')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(`${API}/next/league/4480`, { headers: { 'X-API-KEY': 'test-key' } })
  })

  it('без ближайших матчей берёт сезон у последнего сыгранного (турнир закончился)', async () => {
    mockApi({
      [`${API}/next/league/4490`]: NO_DATA,
      [`${API}/previous/league/4490`]: { schedule: [{ strSeason: '2024-2025' }] },
    })

    expect(await getCurrentSeason('4490')).toBe('2024-2025')
  })

  it('возвращает null, если матчей нет совсем', async () => {
    mockApi({
      [`${API}/next/league/1`]: NO_DATA,
      [`${API}/previous/league/1`]: { schedule: null },
    })

    expect(await getCurrentSeason('1')).toBeNull()
  })
})

describe('getSeasonSchedule', () => {
  it('возвращает матчи сезона', async () => {
    const matches = [{ idEvent: '1' }, { idEvent: '2' }]
    mockApi({ [`${API}/league/4328/2026-2027`]: { schedule: matches } })

    expect(await getSeasonSchedule('4328', '2026-2027')).toEqual(matches)
  })

  it('возвращает пустой список, если поля schedule нет', async () => {
    mockApi({ [`${API}/league/4328/2030-2031`]: NO_DATA })

    expect(await getSeasonSchedule('4328', '2030-2031')).toEqual([])
  })
})

describe('getPenaltyScores', () => {
  it('берёт счёт серии только у матчей, завершённых по пенальти', async () => {
    const fetchMock = mockApi({
      [`${LOOKUP}1`]: { events: [{ intHomeScoreExtra: '4', intAwayScoreExtra: '3' }] },
    })

    const scores = await getPenaltyScores([
      { idEvent: '1', strStatus: 'AP' },
      { idEvent: '2', strStatus: 'FT' },
      { idEvent: '3', strStatus: 'AET' },
    ])

    expect(scores).toEqual({ 1: { home: 4, away: 3 } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('если запрос не удался или счёта нет, отдаёт null, а не 0', async () => {
    mockApi({
      [`${LOOKUP}5`]: { events: [{ intHomeScoreExtra: null, intAwayScoreExtra: null }] },
      [`${LOOKUP}6`]: { events: null },
    })

    const scores = await getPenaltyScores([
      { idEvent: '5', strStatus: 'AP' },
      { idEvent: '6', strStatus: 'AP' },
      { idEvent: '7', strStatus: 'AP' }, // запрос упадёт: его нет в заглушке
    ])

    expect(scores).toEqual({
      5: { home: null, away: null },
      6: { home: null, away: null },
      7: { home: null, away: null },
    })
  })

  it('без матчей AP в API не ходит', async () => {
    const fetchMock = mockApi({})

    expect(await getPenaltyScores([{ idEvent: '1', strStatus: 'FT' }])).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
