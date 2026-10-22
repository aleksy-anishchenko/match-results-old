import type { MatchEvent, MatchLineups, MatchStat, SeasonMatch } from '~/types'
import type { ApiFootballFixture } from '#shared/utils/matchEvents'
import { toSeasonMatch, type ApiFootballSeasonFixture } from './seasonMatch'

// API-Football (api-sports.io). Тариф Pro: 7 500 запросов в день, счётчик обнуляется в 00:00 UTC.
// Сайт переходит на него целиком; пока страницы на TheSportsDB, отсюда берутся только хроника, статистика
// и составы матчей, у которых TheSportsDB ленты нет (РПЛ, Саудовская лига, Бразилия).

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

/** Матч сыгран — в основное время, в дополнительное или по пенальти */
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])

/** Сбой сети или матч у API-Football ещё не закончен — спросим снова через 15 минут */
const RETRY_SOON_MS = 15 * 60 * 1000
/** Матч сыгран, а событий нет или голы не сходятся со счётом — данные если и появятся, то не скоро */
const RETRY_LATER_MS = 6 * 60 * 60 * 1000

/** Хроника, статистика и составы матча из API-Football */
export type FallbackMatchData = {
  events: MatchEvent[]
  stats: MatchStat[]
  lineups: MatchLineups | null
}

// Состояние в памяти процесса. После перезапуска сервера оно пустое, а найденные матчи лежат в хранилище
const retryAt = new Map<string, number>()
const pending = new Map<string, Promise<FallbackMatchData | null>>()

const storageKey = (fixtureId: string) => `api-football:match:${fixtureId}`
/** До хроники (октябрь 2026) из ответа хранились только голы — под этим ключом */
const goalsStorageKey = (fixtureId: string) => `api-football:goals:${fixtureId}`

type SavedGoal = Pick<MatchEvent, 'minute' | 'player' | 'side'> & { kind: 'goal' | 'penalty' | 'own-goal' }

async function loadMatchData(fixtureId: string): Promise<FallbackMatchData | null> {
  const [fixture] = await fetchApiFootball<ApiFootballFixture>('fixtures', { id: fixtureId }).catch(() => [])
  if (!fixture || !FINISHED_STATUSES.has(fixture.fixture.status.short)) {
    retryAt.set(fixtureId, Date.now() + RETRY_SOON_MS)
    return null
  }

  // Без замен и карточек матчей не бывает: пустой список — событий у API-Football нет, а не «ничего не случилось»
  const events = getApiFootballEvents(fixture)
  if (!events.length || !goalsMatchScore(events, String(fixture.goals.home ?? 0), String(fixture.goals.away ?? 0))) {
    retryAt.set(fixtureId, Date.now() + RETRY_LATER_MS)
    return null
  }

  // Хранилище data: на проде — файлы .data/kv рядом с запущенным сервером, деплой их не трогает.
  // Не записалось — данные всё равно отдаём, в следующий раз матч запросим снова
  const matchData: FallbackMatchData = { events, stats: getApiFootballStats(fixture), lineups: getApiFootballLineups(fixture) }
  await useStorage('data').setItem(storageKey(fixtureId), matchData).catch(() => {})
  return matchData
}

/**
 * Сохранённое по матчу раньше, пока из ответа брали не всё: без составов (нет поля lineups) или только голы
 * (старый ключ). Такой матч запрашиваем заново, а если не вышло — отдаём это: показанные голы не должны пропасть
 */
async function getOutdatedMatchData(fixtureId: string, saved: FallbackMatchData | null): Promise<FallbackMatchData | null> {
  if (saved) return { ...saved, lineups: null }
  const goals = await useStorage('data').getItem<SavedGoal[]>(goalsStorageKey(fixtureId))
  return goals ? { events: goals.map(goal => ({ ...goal, assist: null, playerOut: null })), stats: [], lineups: null } : null
}

/**
 * Хроника, статистика и составы сыгранного матча из API-Football по его номеру (idAPIfootball из TheSportsDB).
 * null — не узнать и раньше не сохраняли: ключа нет, у API-Football нет событий или голы не сходятся со счётом,
 * кончился дневной лимит.
 * Сходятся ли голы со счётом TheSportsDB, проверяет вызывающий.
 */
export async function getFallbackMatchData(fixtureId: string | null | undefined): Promise<FallbackMatchData | null> {
  if (!fixtureId) return null

  const saved = await useStorage('data').getItem<FallbackMatchData>(storageKey(fixtureId))
  if (saved && 'lineups' in saved) return saved
  const outdated = await getOutdatedMatchData(fixtureId, saved)

  const apiKey = useRuntimeConfig().apiFootballKey
  const now = Date.now()
  if (!apiKey || now < limitReachedUntil || now < (retryAt.get(fixtureId) ?? 0)) return outdated

  // Страницу матча открыли дважды, пока ответ ещё не пришёл, — запрос всё равно один
  let request = pending.get(fixtureId)
  if (!request) {
    request = loadMatchData(fixtureId).finally(() => pending.delete(fixtureId))
    pending.set(fixtureId, request)
  }
  return (await request) ?? outdated
}
