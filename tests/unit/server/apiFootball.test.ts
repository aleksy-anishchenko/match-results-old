import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchApiFootball,
  getFallbackMatchData,
  getLeagueSeason,
  getSeasonMatches,
  toSeasonMatch,
} from '../../../server/utils/apiFootball'
import { getApiFootballEvents, goalsMatchScore } from '#shared/utils/matchEvents'
import { getApiFootballStats } from '#shared/utils/matchStats'
import { getApiFootballLineups } from '#shared/utils/lineups'
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
  vi.stubGlobal('getApiFootballEvents', getApiFootballEvents)
  vi.stubGlobal('goalsMatchScore', goalsMatchScore)
  vi.stubGlobal('getApiFootballStats', getApiFootballStats)
  vi.stubGlobal('getApiFootballLineups', getApiFootballLineups)
}

const okResponse = async () => ({ response: [afSpartakRubin], errors: [] })
const failingRequest = async () => {
  throw new Error('сеть')
}

// Голы, сохранённые до хроники: только голы, под старым ключом
const savedGoals = [{ minute: 18, player: 'Pablo Solari', side: 'home', kind: 'goal' }]

beforeEach(() => {
  storage = new Map()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// Номер матча в каждом тесте свой: неудачи модуль помнит в памяти между вызовами
describe('getFallbackMatchData', () => {
  it('сохранённый целиком матч — без запроса', async () => {
    const saved = { events: [], stats: [], lineups: null }
    storage.set('api-football:match:1', saved)
    stubNitro('key', okResponse)

    expect(await getFallbackMatchData('1')).toEqual(saved)
    expect($fetch).not.toHaveBeenCalled()
  })

  it('матч, от которого сохранены только голы, запрашиваем заново и сохраняем целиком', async () => {
    storage.set('api-football:goals:2', savedGoals)
    stubNitro('key', okResponse)

    const data = await getFallbackMatchData('2')
    expect(data?.events.filter(event => event.kind === 'goal')).toHaveLength(4)
    expect(data?.lineups?.home.formation).toBe('4-1-4-1')
    expect(storage.get('api-football:match:2')).toEqual(data)
  })

  it('запросить заново не вышло — отдаём сохранённые голы, они не пропадают', async () => {
    storage.set('api-football:goals:3', savedGoals)
    stubNitro('key', failingRequest)

    expect(await getFallbackMatchData('3')).toEqual({
      events: [{ minute: 18, player: 'Pablo Solari', side: 'home', kind: 'goal', assist: null, playerOut: null }],
      stats: [],
      lineups: null,
    })
    // И пока ждём повтора — тоже
    expect(await getFallbackMatchData('3')).toMatchObject({ lineups: null })
    expect($fetch).toHaveBeenCalledTimes(1)
  })

  it('сохранённое без составов при неудачном запросе отдаём как есть', async () => {
    const saved = { events: [{ minute: 5, side: 'away', kind: 'yellow-card', player: 'J. Urozov', assist: null, playerOut: null }], stats: [] }
    storage.set('api-football:match:4', saved)
    stubNitro('key', failingRequest)

    expect(await getFallbackMatchData('4')).toEqual({ ...saved, lineups: null })
  })

  it('без ключа API-Football — только сохранённое, без запроса', async () => {
    storage.set('api-football:goals:5', savedGoals)
    stubNitro('', okResponse)

    expect((await getFallbackMatchData('5'))?.events).toHaveLength(1)
    expect(await getFallbackMatchData('6')).toBeNull()
    expect($fetch).not.toHaveBeenCalled()
  })

  it('ничего не сохранено и запрос не удался — null', async () => {
    stubNitro('key', failingRequest)

    expect(await getFallbackMatchData('7')).toBeNull()
  })
})

const API = 'https://v3.football.api-sports.io'

describe('fetchApiFootball', () => {
  it('отправляет ключ заголовком и отдаёт список из response', async () => {
    stubNitro('key', async () => ({ response: [{ id: 1 }], errors: [] }))

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
    stubNitro('key', async () => ({ response: [], errors: { requests: 'You have reached the request limit for the day' } }))

    await expect(fetchApiFootball('fixtures', { id: 1 })).rejects.toThrow('limit')
    await expect(fetchApiFootball('fixtures', { id: 2 })).rejects.toThrow('лимит')
    expect($fetch).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2020-01-02T00:00:00Z'))
    await expect(fetchApiFootball('fixtures', { id: 3 })).rejects.toThrow('limit')
    expect($fetch).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
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
