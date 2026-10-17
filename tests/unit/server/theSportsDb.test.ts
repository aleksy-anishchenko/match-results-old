import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCurrentSeason, getSeasonSchedule } from '../../../server/utils/theSportsDb'

const API = 'https://www.thesportsdb.com/api/v2/json/schedule'
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
      [`${API}/next/league/4502`]: NO_DATA,
      [`${API}/previous/league/4502`]: { schedule: [{ strSeason: '2024' }] },
    })

    expect(await getCurrentSeason('4502')).toBe('2024')
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
    mockApi({ [`${API}/league/4429/2026`]: { schedule: matches } })

    expect(await getSeasonSchedule('4429', '2026')).toEqual(matches)
  })

  it('возвращает пустой список, если поля schedule нет', async () => {
    mockApi({ [`${API}/league/4429/2030`]: NO_DATA })

    expect(await getSeasonSchedule('4429', '2030')).toEqual([])
  })
})
