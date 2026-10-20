import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getFallbackMatchData } from '../../../server/utils/apiFootball'
import { getApiFootballEvents, goalsMatchScore } from '#shared/utils/matchEvents'
import { getApiFootballStats } from '#shared/utils/matchStats'
import { getApiFootballLineups } from '#shared/utils/lineups'
import afSpartakRubin from '../../fixtures/api-football/spartak-rubin.json'

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
