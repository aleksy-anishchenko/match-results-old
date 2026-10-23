import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchApiFootball, getCompetitionSeason, getFixturesByIds, getLeagueSeason, getMatchFixture, getSeasonMatches } from '../../../server/utils/apiFootball'
import { toMatch, toSeasonMatch } from '../../../server/utils/seasonMatch'
import afSpartakRubin from '../../fixtures/api-football/spartak-rubin.json'
import championsLeague2526 from '../../fixtures/api-football/seasons/champions-league-2025-26.json'
import championsLeague2627 from '../../fixtures/api-football/seasons/champions-league-2026-27.json'

// Кэш Nitro (defineCachedFunction) вызывается при загрузке модуля — раньше, чем beforeEach: подменяем заранее, без кэша
vi.hoisted(() => {
  Object.assign(globalThis, { defineCachedFunction: (fn: unknown) => fn })
})

// Хранилище Nitro в памяти теста
let storage: Map<string, unknown>

// Глобальные функции Nitro (useStorage, $fetch, авто-импорты из shared/utils) подменяем
function stubNitro(apiKey: string, fetchMock: (...args: unknown[]) => Promise<unknown>) {
  vi.stubGlobal('useRuntimeConfig', () => ({ apiFootballKey: apiKey }))
  vi.stubGlobal('useStorage', () => ({
    getItem: async (key: string) => storage.get(key) ?? null,
    setItem: async (key: string, value: unknown) => void storage.set(key, value),
  }))
  vi.stubGlobal('$fetch', vi.fn(fetchMock))
}

const respond = (...response: unknown[]) => async () => ({ response, errors: [] })

beforeEach(() => {
  storage = new Map()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const API = 'https://v3.football.api-sports.io'

describe('fetchApiFootball', () => {
  it('отправляет ключ заголовком и отдаёт список из response', async () => {
    stubNitro('key', respond({ id: 1 }))

    expect(await fetchApiFootball('fixtures', { league: 235, season: 2026 })).toEqual([{ id: 1 }])
    expect($fetch).toHaveBeenCalledWith(`${API}/fixtures`, expect.objectContaining({
      query: { league: 235, season: 2026 },
      headers: { 'x-apisports-key': 'key' },
    }))
  })

  it('ошибка в ответе — исключение', async () => {
    stubNitro('key', async () => ({ response: [], errors: { plan: 'Free plans do not have access to this season' } }))

    await expect(fetchApiFootball('standings', { league: 235, season: 2026 })).rejects.toThrow('Free plans')
  })

  it('без ключа — исключение без запроса', async () => {
    stubNitro('', async () => ({ response: [], errors: [] }))

    await expect(fetchApiFootball('fixtures', { id: 1 })).rejects.toThrow('ключа')
    expect($fetch).not.toHaveBeenCalled()
  })

  it('кончился дневной лимит — до полуночи UTC не спрашиваем', async () => {
    // Дата в прошлом: лимит «кончается» до неё, и другие тесты он не задевает
    vi.useFakeTimers({ now: new Date('2020-01-01T12:00:00Z') })
    try {
      stubNitro('key', async () => ({ response: [], errors: { requests: 'You have reached the request limit for the day' } }))

      await expect(fetchApiFootball('fixtures', { id: 1 })).rejects.toThrow('limit')
      await expect(fetchApiFootball('fixtures', { id: 2 })).rejects.toThrow('лимит')
      expect($fetch).toHaveBeenCalledTimes(1)

      vi.setSystemTime(new Date('2020-01-02T00:00:00Z'))
      await expect(fetchApiFootball('fixtures', { id: 3 })).rejects.toThrow('limit')
      expect($fetch).toHaveBeenCalledTimes(2)
    }
    finally {
      vi.useRealTimers()
    }
  })

  // Перебор номеров матчей извне не должен оставить сайт без расписаний и таблиц до полуночи
  it('лимит на исходе — матчи по номеру и живой счёт не спрашиваем, расписание спрашиваем', async () => {
    const withRemaining = (count: string) => async (_url: unknown, options: unknown) => {
      (options as { onResponse: (context: { response: Response }) => void }).onResponse({
        response: new Response(null, { headers: { 'x-ratelimit-requests-remaining': count } }),
      })
      return { response: [], errors: [] }
    }
    stubNitro('key', withRemaining('999'))
    await fetchApiFootball('fixtures', { league: 39, season: 2026 })

    await expect(fetchApiFootball('fixtures', { id: 1 }, { spare: true })).rejects.toThrow('бережём')
    await fetchApiFootball('fixtures', { league: 39, season: 2026 })
    expect($fetch).toHaveBeenCalledTimes(2)

    stubNitro('key', withRemaining('5000'))
    await fetchApiFootball('standings', { league: 39, season: 2026 })
    await fetchApiFootball('fixtures', { id: 1 }, { spare: true })
    expect($fetch).toHaveBeenCalledTimes(2)
  })
})

describe('getLeagueSeason', () => {
  it('текущий сезон — год его начала', async () => {
    stubNitro('key', async () => ({ response: [{ seasons: [{ year: 2026, current: true }] }], errors: [] }))

    expect(await getLeagueSeason('2')).toBe(2026)
    expect($fetch).toHaveBeenCalledWith(`${API}/leagues`, expect.objectContaining({ query: { id: '2', current: 'true' } }))
  })

  it('турнира нет — null', async () => {
    stubNitro('key', async () => ({ response: [], errors: [] }))

    expect(await getLeagueSeason('999')).toBeNull()
  })
})

describe('getCompetitionSeason', () => {
  it('турнир сайта и его сезон; без номера — турнир по умолчанию', async () => {
    stubNitro('key', async () => ({ response: [{ seasons: [{ year: 2026, current: true }] }], errors: [] }))

    expect(await getCompetitionSeason('2')).toMatchObject({ competition: { id: '2', name: 'Лига чемпионов' }, season: 2026 })
    expect(await getCompetitionSeason(undefined)).toMatchObject({ competition: { id: '39' }, season: 2026 })
  })

  // Каждый запрос к API-Football — из дневного лимита
  it('турнир не из списка сайта — null, API не спрашиваем', async () => {
    stubNitro('key', respond())

    expect(await getCompetitionSeason('999')).toBeNull()
    expect(await getCompetitionSeason('39abc')).toBeNull()
    expect($fetch).not.toHaveBeenCalled()
  })

  it('текущего сезона нет в API — null', async () => {
    stubNitro('key', async () => ({ response: [], errors: [] }))

    expect(await getCompetitionSeason('39')).toBeNull()
  })
})

describe('toSeasonMatch', () => {
  it('финал по пенальти: названия по-русски, счёт серии, время UTC без смещения', () => {
    const final = championsLeague2526.find(fixture => fixture.league.round === 'Final')!

    expect(toSeasonMatch(final)).toEqual({
      id: '1544371',
      round: 'Final',
      timestamp: '2026-05-30T16:00:00',
      status: 'PEN',
      home: { id: 85, name: 'ПСЖ', badge: '' },
      away: { id: 42, name: 'Арсенал', badge: '' },
      homeScore: 1,
      awayScore: 1,
      homePenalties: 4,
      awayPenalties: 3,
    })
  })

  it('матч, который ещё не сыгран: счёта нет', () => {
    const upcoming = championsLeague2627.find(fixture => fixture.fixture.id === 1635669)!

    expect(toSeasonMatch(upcoming)).toMatchObject({
      round: 'League Stage - 4',
      timestamp: '2026-11-03T17:45:00',
      status: 'NS',
      home: { name: 'Галатасарай' },
      away: { name: 'Штутгарт' },
      homeScore: null,
      awayScore: null,
      homePenalties: null,
    })
  })
})

describe('toMatch', () => {
  it('матч для главной: тур из навигации, минуту подставит страница', () => {
    const final = toSeasonMatch(championsLeague2526.find(fixture => fixture.league.round === 'Final')!)

    expect(toMatch(final, 'playoff-final')).toEqual({
      id: '1544371',
      homeTeam: 'ПСЖ',
      awayTeam: 'Арсенал',
      homeBadge: '',
      awayBadge: '',
      homeScore: '1',
      awayScore: '1',
      homePenScore: 4,
      awayPenScore: 3,
      status: 'PEN',
      progress: null,
      timestamp: '2026-05-30T16:00:00',
      round: 'playoff-final',
    })
  })
})

describe('getSeasonMatches', () => {
  it('все матчи сезона по времени начала', async () => {
    stubNitro('key', async () => ({ response: [...championsLeague2526].reverse(), errors: [] }))

    const matches = await getSeasonMatches('2', 2025)
    expect(matches).toHaveLength(championsLeague2526.length)
    expect(matches.at(-1)?.round).toBe('Final')
    expect(matches.every((match, index) => index === 0 || matches[index - 1]!.timestamp <= match.timestamp)).toBe(true)
    expect($fetch).toHaveBeenCalledWith(`${API}/fixtures`, expect.objectContaining({ query: { league: '2', season: 2025 } }))
  })
})

describe('getMatchFixture', () => {
  // Спартак – Рубин сыгран 18 октября 2026: прошло больше 4 часов
  it('сыгранный матч сохраняет без оценок игроков и больше не запрашивает', async () => {
    stubNitro('key', respond({ ...afSpartakRubin, players: [{ team: { id: 558 } }] }))

    const fixture = await getMatchFixture('1561417')
    expect(fixture?.fixture.id).toBe(1561417)
    expect(storage.get('api-football:fixture:1561417')).not.toHaveProperty('players')
    expect(await getMatchFixture('1561417')).toEqual(storage.get('api-football:fixture:1561417'))
    expect($fetch).toHaveBeenCalledTimes(1)
  })

  it('идущий матч и только что закончившийся не сохраняет: API ещё дописывает данные', async () => {
    const justNow = Math.floor(Date.now() / 1000) - 2 * 60 * 60
    stubNitro('key', respond(
      { ...afSpartakRubin, fixture: { ...afSpartakRubin.fixture, id: 1, status: { ...afSpartakRubin.fixture.status, short: '2H' } } },
    ))
    expect(await getMatchFixture('1')).not.toBeNull()
    stubNitro('key', respond({ ...afSpartakRubin, fixture: { ...afSpartakRubin.fixture, id: 2, timestamp: justNow } }))
    expect(await getMatchFixture('2')).not.toBeNull()
    expect(storage.size).toBe(0)
  })

  // Хроника, которую API может ещё дописать, навсегда не сохраняется
  it('сыгранный матч, у которого голы хроники не сходятся со счётом, не сохраняет', async () => {
    stubNitro('key', respond({ ...afSpartakRubin, fixture: { ...afSpartakRubin.fixture, id: 6 }, goals: { home: 5, away: 0 } }))
    expect(await getMatchFixture('6')).not.toBeNull()
    stubNitro('key', respond({ ...afSpartakRubin, fixture: { ...afSpartakRubin.fixture, id: 7 }, events: [] }))
    expect(await getMatchFixture('7')).not.toBeNull()
    expect(storage.size).toBe(0)
  })

  it('матча нет или он не из турниров сайта — null', async () => {
    stubNitro('key', respond())
    expect(await getMatchFixture('3')).toBeNull()
    stubNitro('key', respond({ ...afSpartakRubin, league: { ...afSpartakRubin.league, id: 999 } }))
    expect(await getMatchFixture('4')).toBeNull()
    expect(storage.size).toBe(0)
  })

  it('сбой API — исключение: страница покажет ошибку, а не «матч не найден»', async () => {
    stubNitro('key', async () => {
      throw new Error('сеть')
    })
    await expect(getMatchFixture('5')).rejects.toThrow('сеть')
  })
})

describe('getFixturesByIds', () => {
  it('по 20 номеров в запросе, ответы вместе', async () => {
    stubNitro('key', async (...args: unknown[]) => {
      const ids = String((args[1] as { query: { ids: string } }).query.ids).split('-')
      return { response: ids.map(id => ({ fixture: { id: Number(id) } })), errors: [] }
    })
    const ids = Array.from({ length: 25 }, (_, index) => String(index + 1))

    const fixtures = await getFixturesByIds(ids)
    expect(fixtures.map(item => item.fixture.id)).toEqual(ids.map(Number))
    expect($fetch).toHaveBeenCalledTimes(2)
    expect($fetch).toHaveBeenCalledWith(`${API}/fixtures`, expect.objectContaining({ query: { ids: ids.slice(0, 20).join('-') }, timeout: 5000 }))
  })
})
