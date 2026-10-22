import type { SeasonMatch } from '~/types'
import type { ApiFootballFixture } from '#shared/utils/matchEvents'
import { toSeasonMatch, type ApiFootballSeasonFixture } from './seasonMatch'
import type { ApiFootballStandingRow } from './leagueTable'

// API-Football (api-sports.io) — источник всех данных сайта. Тариф Pro: 7 500 запросов в день,
// счётчик обнуляется в 00:00 UTC. Ответы кэшируются, чтобы посетители не тратили лимит.

const API = 'https://v3.football.api-sports.io'
const TIMEOUT_MS = 10_000

type ApiFootballResponse<T> = {
  response?: T[]
  /** [] — всё хорошо. Объект — ошибка: { requests: … } — кончился дневной лимит, { plan: … } — нет доступа */
  errors?: unknown[] | Record<string, string>
}

/** Кончился дневной лимит: до полуночи UTC не спрашиваем, ответ всё равно будет ошибкой */
let limitReachedUntil = 0

function nextUtcMidnight(now: number): number {
  const date = new Date(now)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
}

/**
 * Запрос к API-Football: список из поля response. Ошибка API (кончился лимит, нет доступа), нет ключа,
 * сбой сети — исключение: показать ошибку или обойтись без этих данных, решает вызывающий
 */
export async function fetchApiFootball<T>(path: string, query: Record<string, string | number>): Promise<T[]> {
  const apiKey = useRuntimeConfig().apiFootballKey
  if (!apiKey) throw new Error('Нет ключа API-Football')
  if (Date.now() < limitReachedUntil) throw new Error('Кончился дневной лимит API-Football')

  const data = await $fetch<ApiFootballResponse<T>>(`${API}/${path}`, {
    query,
    headers: { 'x-apisports-key': apiKey },
    timeout: TIMEOUT_MS,
  })
  const { errors } = data
  const messages = Array.isArray(errors) ? errors : Object.values(errors ?? {})
  if (messages.length) {
    if (errors && !Array.isArray(errors) && 'requests' in errors) limitReachedUntil = nextUtcMidnight(Date.now())
    throw new Error(`API-Football: ${messages.join('; ')}`)
  }
  return data.response ?? []
}

/**
 * Текущий сезон турнира — год его начала: 2026/27 — 2026, сезон МЛС 2026 — тоже 2026. null — текущего сезона нет.
 * Меняется раз в год, поэтому ответ хранится сутки
 */
export const getLeagueSeason = defineCachedFunction(async (leagueId: string): Promise<number | null> => {
  const [league] = await fetchApiFootball<{ seasons: Array<{ year: number, current: boolean }> }>(
    'leagues',
    { id: leagueId, current: 'true' },
  )
  return league?.seasons.find(season => season.current)?.year ?? null
}, {
  name: 'api-football-season',
  maxAge: 24 * 60 * 60,
  getKey: (leagueId: string) => leagueId,
})

/**
 * Все матчи сезона по времени начала. Счёт идущих матчей и минуту страницы берут из живых данных,
 * поэтому расписание хранится 5 минут
 */
export const getSeasonMatches = defineCachedFunction(async (leagueId: string, season: number): Promise<SeasonMatch[]> => {
  const fixtures = await fetchApiFootball<ApiFootballSeasonFixture>('fixtures', { league: leagueId, season })
  return fixtures.map(toSeasonMatch).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}, {
  name: 'api-football-season-matches',
  maxAge: 5 * 60,
  getKey: (leagueId: string, season: number) => `${leagueId}-${season}`,
})

/** Таблица турнира — группы строк. Меняется только после матчей, поэтому хранится 10 минут */
export const getLeagueStandings = defineCachedFunction(async (leagueId: string, season: number): Promise<ApiFootballStandingRow[][]> => {
  const [response] = await fetchApiFootball<{ league: { standings: ApiFootballStandingRow[][] } }>(
    'standings',
    { league: leagueId, season },
  )
  return response?.league.standings ?? []
}, {
  name: 'api-football-standings',
  maxAge: 10 * 60,
  getKey: (leagueId: string, season: number) => `${leagueId}-${season}`,
})

/** Через сколько после начала сыгранный матч сохраняем навсегда: к этому времени API-Football дописывает статистику */
const SETTLED_AFTER_MS = 4 * 60 * 60 * 1000

const fixtureKey = (id: string) => `api-football:fixture:${id}`

/**
 * Матч по номеру — с хроникой, статистикой и составами, всё одним запросом (fixtures?id=). null — матча нет
 * или он не из турниров сайта. Сыгранный матч больше не меняется: через 4 часа после начала он хранится всегда
 * (хранилище data, на проде — файлы .data/kv рядом с сервером, деплой их не трогает), и за ним больше не ходим
 */
export async function getMatchFixture(id: string): Promise<ApiFootballFixture | null> {
  const storage = useStorage('data')
  const saved = await storage.getItem<ApiFootballFixture>(fixtureKey(id)).catch(() => null)
  if (saved) return saved

  const [fixture] = await fetchApiFootball<ApiFootballFixture>('fixtures', { id })
  if (!fixture || !getCompetition(String(fixture.league.id))) return null

  const settled = FINISHED_MATCH_STATUSES.has(fixture.fixture.status.short)
    && Date.now() - fixture.fixture.timestamp * 1000 > SETTLED_AFTER_MS
  if (settled) {
    // Без оценок и статистики игроков (players): они большие, а сайту не нужны. Не записалось — запросим снова
    const { fixture: info, league, teams, goals, score, events, statistics, lineups } = fixture
    await storage.setItem(fixtureKey(id), { fixture: info, league, teams, goals, score, events, statistics, lineups }).catch(() => {})
  }
  return fixture
}
