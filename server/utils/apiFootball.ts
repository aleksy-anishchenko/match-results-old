import type { MatchEvent, MatchLineups, MatchStat } from '~/types'
import type { ApiFootballFixture } from '#shared/utils/matchEvents'

// Запасной источник хроники, статистики и составов — API-Football (api-sports.io), для матчей, где у TheSportsDB ленты
// событий нет или она не сходится со счётом (РПЛ с октября 2025, Саудовская лига, Бразилия). Номер матча
// в API-Football TheSportsDB отдаёт сам — idAPIfootball. Бесплатный тариф — 100 запросов в день, счётчик
// обнуляется в 00:00 UTC; весь сезон на нём закрыт, а один матч по номеру (fixtures?id=) отдаётся вместе
// с событиями, статистикой и составами. Поэтому каждый матч спрашиваем один раз: данные сыгранного матча не меняются,
// найденные хранятся всегда.

const API = 'https://v3.football.api-sports.io'

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

type FixturesResponse = {
  response?: ApiFootballFixture[]
  /** [] — всё хорошо. Объект — ошибка: { requests: … } — кончился дневной лимит, { plan: … } — нет доступа */
  errors?: unknown[] | Record<string, string>
}

// Состояние в памяти процесса. После перезапуска сервера оно пустое, а найденные матчи лежат в хранилище
const retryAt = new Map<string, number>()
const pending = new Map<string, Promise<FallbackMatchData | null>>()
let limitReachedUntil = 0

const storageKey = (fixtureId: string) => `api-football:match:${fixtureId}`
/** До хроники (октябрь 2026) из ответа хранились только голы — под этим ключом */
const goalsStorageKey = (fixtureId: string) => `api-football:goals:${fixtureId}`

type SavedGoal = Pick<MatchEvent, 'minute' | 'player' | 'side'> & { kind: 'goal' | 'penalty' | 'own-goal' }

function nextUtcMidnight(now: number): number {
  const date = new Date(now)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
}

async function loadMatchData(fixtureId: string, apiKey: string): Promise<FallbackMatchData | null> {
  const data = await $fetch<FixturesResponse>(`${API}/fixtures`, {
    query: { id: fixtureId },
    headers: { 'x-apisports-key': apiKey },
  }).catch(() => null)

  const errors = data?.errors
  if (!data || (errors && !Array.isArray(errors))) {
    if (errors && !Array.isArray(errors) && 'requests' in errors) limitReachedUntil = nextUtcMidnight(Date.now())
    else retryAt.set(fixtureId, Date.now() + RETRY_SOON_MS)
    return null
  }

  const fixture = data.response?.[0]
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
    request = loadMatchData(fixtureId, apiKey).finally(() => pending.delete(fixtureId))
    pending.set(fixtureId, request)
  }
  return (await request) ?? outdated
}
