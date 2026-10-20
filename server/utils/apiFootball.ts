import type { MatchGoal } from '~/types'
import type { ApiFootballFixture } from '#shared/utils/goals'

// Запасной источник голов — API-Football (api-sports.io), для матчей, где у TheSportsDB ленты событий нет
// или она не сходится со счётом (РПЛ с октября 2025, Саудовская лига, Бразилия). Номер матча в API-Football
// TheSportsDB отдаёт сам — idAPIfootball. Бесплатный тариф — 100 запросов в день, счётчик обнуляется в 00:00 UTC;
// весь сезон на нём закрыт, а один матч по номеру (fixtures?id=) отдаётся. Поэтому каждый матч спрашиваем
// один раз: события сыгранного матча не меняются, найденные голы хранятся всегда.

const API = 'https://v3.football.api-sports.io'

/** Матч сыгран — в основное время, в дополнительное или по пенальти */
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])

/** Сбой сети или матч у API-Football ещё не закончен — спросим снова через 15 минут */
const RETRY_SOON_MS = 15 * 60 * 1000
/** Матч сыгран, а голов нет или они не сходятся со счётом — данные если и появятся, то не скоро */
const RETRY_LATER_MS = 6 * 60 * 60 * 1000

type FixturesResponse = {
  response?: ApiFootballFixture[]
  /** [] — всё хорошо. Объект — ошибка: { requests: … } — кончился дневной лимит, { plan: … } — нет доступа */
  errors?: unknown[] | Record<string, string>
}

// Состояние в памяти процесса. После перезапуска сервера оно пустое, а найденные голы лежат в хранилище
const retryAt = new Map<string, number>()
const pending = new Map<string, Promise<MatchGoal[] | null>>()
let limitReachedUntil = 0

const storageKey = (fixtureId: string) => `api-football:goals:${fixtureId}`

function nextUtcMidnight(now: number): number {
  const date = new Date(now)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
}

async function loadGoals(fixtureId: string, apiKey: string): Promise<MatchGoal[] | null> {
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

  const goals = getApiFootballGoals(fixture)
  if (!goalsMatchScore(goals, String(fixture.goals.home ?? 0), String(fixture.goals.away ?? 0))) {
    retryAt.set(fixtureId, Date.now() + RETRY_LATER_MS)
    return null
  }

  // Хранилище data: на проде — файлы .data/kv рядом с запущенным сервером, деплой их не трогает
  await useStorage('data').setItem(storageKey(fixtureId), goals)
  return goals
}

/**
 * Голы сыгранного матча из API-Football по его номеру (idAPIfootball из TheSportsDB). null — голов не узнать:
 * ключа нет, у API-Football нет событий или они не сходятся со счётом, кончился дневной лимит.
 * Сходится ли список со счётом TheSportsDB, проверяет вызывающий.
 */
export async function getFallbackGoals(fixtureId: string | null | undefined): Promise<MatchGoal[] | null> {
  const apiKey = useRuntimeConfig().apiFootballKey
  if (!apiKey || !fixtureId) return null

  const saved = await useStorage('data').getItem<MatchGoal[]>(storageKey(fixtureId))
  if (saved) return saved

  const now = Date.now()
  if (now < limitReachedUntil || now < (retryAt.get(fixtureId) ?? 0)) return null

  // Страницу матча открыли дважды, пока ответ ещё не пришёл, — запрос всё равно один
  let request = pending.get(fixtureId)
  if (!request) {
    request = loadGoals(fixtureId, apiKey).finally(() => pending.delete(fixtureId))
    pending.set(fixtureId, request)
  }
  return request
}
